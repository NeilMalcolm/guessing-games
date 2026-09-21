import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: 'batch-movie-fetcher' });
const ssm = new SSMClient({});
const s3 = new S3Client({});
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const SSM_PAGE_PARAM = process.env.SSM_PAGE_PARAMETER_NAME!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const JSON_FILE_KEY = process.env.S3_JSON_KEY!;
const linesToRead = 100;

export const handler = async (event: any) => {
  logger.info("Starting batch fetcher...");

  // 1. Get current offset (reusing SSM_PAGE_PARAM for offset)
  let currentOffset = 0;
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: SSM_PAGE_PARAM }));
    currentOffset = parseInt(res.Parameter?.Value || "0", 10);
  } catch (err: any) {
    logger.error("Failed to read SSM param, defaulting to offset 0", { err });
  }

  // 2. Fetch JSON Lines file from S3
  let fileContent: string | undefined;
  try {
    const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: JSON_FILE_KEY }));
    fileContent = await s3Res.Body?.transformToString();
  } catch (err: any) {
    logger.error("Failed to read S3 file", { err });
    return;
  }
  
  if (!fileContent) {
    logger.error("S3 file is empty");
    return;
  }

  const lines = fileContent.split('\n').filter(l => l.trim() !== '');
  
  if (currentOffset >= lines.length) {
    logger.info("Reached end of file. Stopping.");
    return;
  }

  const moviesToInsert: any[] = [];
  const nextOffset = currentOffset + linesToRead;
  const batch = lines.slice(currentOffset, nextOffset);
  
  logger.info(`Processing lines ${currentOffset} to ${currentOffset + batch.length}`);
  
  // 3. Query details for each movie
  for (const line of batch) {
    let movie: any;
    try {
      movie = JSON.parse(line);
    } catch(err) {
      logger.error("Failed to parse JSON line", { line, err });
      continue;
    }
      const detailsUrl = `${TMDB_BASE_URL}/movie/${movie.id}?language=en-gb&append_to_response=release_dates,credits`;
      const detailsRes = await fetch(detailsUrl, {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });
      if (!detailsRes.ok) {
        logger.error(`Details failed for movie ${movie.id}`, { error: await detailsRes.text() });
        continue;
      }
      
      const details = await detailsRes.json() as any;
      
      // Parse min_age and certifications from release_dates
      let minAge = null;
      let certifications: Record<string, string> = {};
      if (details.release_dates && details.release_dates.results) {
        for (const rd of details.release_dates.results) {
          const iso = rd.iso_3166_1;
          const certs = rd.release_dates.map((r: any) => r.certification).filter((c: any) => c);
          if (certs.length > 0) {
            certifications[iso] = certs[0];
          }
        }
      }
      // Simple heuristic for minAge based on GB certification
      if (certifications["GB"]) {
        const c = certifications["GB"].toUpperCase();
        if (c.includes("12") || c.includes("12A")) minAge = 12;
        else if (c.includes("15")) minAge = 15;
        else if (c.includes("18")) minAge = 18;
        else if (c.includes("PG")) minAge = 8;
        else if (c.includes("U")) minAge = 0;
      }
      
      // Cast members
      let cast_members = [];
      if (details.credits && details.credits.cast) {
        cast_members = details.credits.cast.slice(0, 15).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          order: c.order,
          profile_path: c.profile_path,
        }));
      }

      // Director
      let director = null;
      let director_profile_path = null;
      if (details.credits && details.credits.crew) {
        const d = details.credits.crew.find((c: any) => c.job === "Director");
        if (d) {
          director = d.name;
          director_profile_path = d.profile_path || null;
        }
      }

      // 4. Validate essential fields
      if (
        !details.title ||
        !details.poster_path ||
        !details.release_date ||
        !director ||
        !cast_members || cast_members.length === 0 ||
        !details.genres || details.genres.length === 0 ||
        !details.revenue || details.revenue <= 0 ||
        !details.vote_average || details.vote_average <= 0 ||
        minAge === null
      ) {
        logger.info(`Skipping movie ${details.id} (${details.title || 'Unknown'}): Missing essential fields for the game`);
        continue;
      }

      moviesToInsert.push({
        id: details.id,
        title: details.title,
        release_year: details.release_date ? parseInt(details.release_date.substring(0, 4)) : null,
        poster_path: details.poster_path,
        genres: (details.genres || []).map((g: any) => g.name),
        director,
        director_profile_path,
        popularity: details.popularity,
        cast_members,
        box_office: details.revenue,
        rating: details.vote_average,
        vote_count: details.vote_count,
        min_age: minAge,
        certifications,
        cached_at: new Date().toISOString(),
      });
    }

  logger.info(`Fetched ${moviesToInsert.length} movies. Upserting to Supabase...`);

  // 3. Write to Supabase
  if (moviesToInsert.length > 0) {
    const { error } = await supabase.from("movies").upsert(moviesToInsert, { onConflict: "id" });
    if (error) {
      logger.error("Supabase upsert error:", { error });
      throw error;
    }
  }

  // 4. Update SSM parameter
  await ssm.send(new PutParameterCommand({
    Name: SSM_PAGE_PARAM,
    Value: nextOffset.toString(),
    Type: "String",
    Overwrite: true,
  }));
  logger.info(`Updated SSM parameter to ${nextOffset}`);
};
