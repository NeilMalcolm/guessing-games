import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: 'batch-movie-fetcher' });
const ssm = new SSMClient({});
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const SSM_PAGE_PARAM = process.env.SSM_PAGE_PARAMETER_NAME!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export const handler = async (event: any) => {
  console.log("Starting batch fetcher...");
  logger.info("Starting batch fetcher...");

  // 1. Get current page
  let currentPage = 1;
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: SSM_PAGE_PARAM }));
    currentPage = parseInt(res.Parameter?.Value || "1", 10);
  } catch (err: any) {
    console.error("Failed to read SSM param, defaulting to page 1", err);
    logger.error("Failed to read SSM param, defaulting to page 1", { err });
  }

  if (currentPage > 500) {
    console.log("Reached page 500 max limit. Stopping.");
    logger.info("Reached page 500 max limit. Stopping.");
    return;
  }

  const moviesToInsert: any[] = [];
  
  // Fetch up to 5 pages (100 movies)
  for (let p = currentPage; p < currentPage + 5; p++) {
    if (p > 500) break;
    console.log(`Fetching discover page ${p}`);
    logger.info(`Fetching discover page ${p}`);
    
    // 1. Query discover
    const discoverUrl = `${TMDB_BASE_URL}/discover/movie?page=${p}&region=GB&sort_by=popularity.desc&certification=GB&with_release_type=1|2|3&vote_average.gte=1&with_origin_country=GB|US&vote_count.gte=1000`;
    
    const discoverRes = await fetch(discoverUrl, {
      headers: {
        Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
        accept: "application/json"
      }
    });
    if (!discoverRes.ok) {
      console.error(`Discover failed for page ${p}`, await discoverRes.text());
      logger.error(`Discover failed for page ${p}`, { error: await discoverRes.text() });
      continue;
    }
    
    const discoverData = await discoverRes.json() as any;
    const results = discoverData.results || [];
    
    // 2. Query each movie
    for (const movie of results) {
      const detailsUrl = `${TMDB_BASE_URL}/movie/${movie.id}?language=en-gb&append_to_response=release_dates,credits`;
      const detailsRes = await fetch(detailsUrl, {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });
      if (!detailsRes.ok) {
        console.error(`Details failed for movie ${movie.id}`, await detailsRes.text());
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
  }

  console.log(`Fetched ${moviesToInsert.length} movies. Upserting to Supabase...`);
  logger.info(`Fetched ${moviesToInsert.length} movies. Upserting to Supabase...`);

  // 3. Write to Supabase
  if (moviesToInsert.length > 0) {
    const { error } = await supabase.from("movies").upsert(moviesToInsert, { onConflict: "id" });
    if (error) {
      console.error("Supabase upsert error:", error);
      logger.error("Supabase upsert error:", { error });
      throw error;
    }
  }

  // 4. Update SSM parameter
  const nextPage = currentPage + 5;
  await ssm.send(new PutParameterCommand({
    Name: SSM_PAGE_PARAM,
    Value: nextPage.toString(),
    Type: "String",
    Overwrite: true,
  }));
  console.log(`Updated SSM parameter to ${nextPage}`);
  logger.info(`Updated SSM parameter to ${nextPage}`);
};
