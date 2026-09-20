import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const paramName = '/guessing-games/tmdb-batch-fetcher/current-page';

    const batchFetcherLambda = new NodejsFunction(this, 'BatchMovieFetcher', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/batch-movie-fetcher.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      environment: {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN || '',
        SSM_PAGE_PARAMETER_NAME: paramName,
      },
    });

    // Grant lambda read/write access to the parameter by ARN
    const paramArn = `arn:aws:ssm:${this.region}:${this.account}:parameter${paramName}`;
    batchFetcherLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:PutParameter'],
      resources: [paramArn],
    }));

    // EventBridge Rule: every 2 minutes
    // Commented-out until we confirm this works well.
    // const rule = new events.Rule(this, 'BatchFetcherScheduleRule', {
    //   schedule: events.Schedule.rate(cdk.Duration.minutes(2)),
    // });

    // rule.addTarget(new targets.LambdaFunction(batchFetcherLambda));
  }
}
