import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for the JSON file
    const tmdbDataBucket = new s3.Bucket(this, 'TmdbDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy the JSON file to the bucket
    new s3deploy.BucketDeployment(this, 'DeployTmdbData', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../src'), {
        exclude: ['**', '!movie_ids_09_13_2026_min.json']
      })],
      destinationBucket: tmdbDataBucket,
    });

    const paramName = '/guessing-games/tmdb-batch-fetcher/current-page';

    const batchFetcherLambda = new NodejsFunction(this, 'BatchMovieFetcher', {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(__dirname, '../src/batch-movie-fetcher.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      environment: {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN || '',
        SSM_PAGE_PARAMETER_NAME: paramName,
        S3_BUCKET_NAME: tmdbDataBucket.bucketName,
        S3_JSON_KEY: 'movie_ids_09_13_2026_min.json',
      },
    });

    // Grant lambda read access to the bucket
    tmdbDataBucket.grantRead(batchFetcherLambda);

    // Grant lambda read/write access to the parameter by ARN
    const paramArn = `arn:aws:ssm:${this.region}:${this.account}:parameter${paramName}`;
    batchFetcherLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:PutParameter'],
      resources: [paramArn],
    }));

    // EventBridge Rule: every 2 minutes
    const rule = new events.Rule(this, 'BatchFetcherScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(2)),
    });
    rule.addTarget(new targets.LambdaFunction(batchFetcherLambda));

    // Daily Movie Picker Lambda
    const dailyPickerLambda = new NodejsFunction(this, 'DailyMoviePicker', {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(__dirname, '../src/daily-movie-picker.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(1),
      environment: {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
    });

    // EventBridge Rule: Run at 23:00 UTC every day
    const dailyRule = new events.Rule(this, 'DailyPickerScheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '23' }),
    });
    dailyRule.addTarget(new targets.LambdaFunction(dailyPickerLambda));
  }
}
