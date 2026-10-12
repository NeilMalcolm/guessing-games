import { createClient } from "@supabase/supabase-js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: 'movie-video-fetcher' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const BATCH_SIZE = 100;

interface TmdbVideoResult {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  key: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  id: string;
  published_at: string;
}

interface TmdbVideosResponse {
  id: number;
  results: TmdbVideoResult[];
}

/**
 * Selects the best YouTube video key (slug) from TMDB video results.
 * Prioritizes Trailers, Teasers, and official YouTube videos.
 */
function selectBestYoutubeSlug(videos: TmdbVideoResult[]): string | null {
  const youtubeVideos = videos.filter(
    (v) => v.site?.toLowerCase() === "youtube" && v.key
  );

  if (youtubeVideos.length === 0) {
    return null;
  }

  // 1. Official Trailer
  const officialTrailer = youtubeVideos.find(
    (v) => v.type === "Trailer" && v.official
  );
  if (officialTrailer) return officialTrailer.key;

  // 2. Any Trailer
  const anyTrailer = youtubeVideos.find((v) => v.type === "Trailer");
  if (anyTrailer) return anyTrailer.key;

  // 3. Official Teaser
  const officialTeaser = youtubeVideos.find(
    (v) => v.type === "Teaser" && v.official
  );
  if (officialTeaser) return officialTeaser.key;

  // 4. Any Teaser
  const anyTeaser = youtubeVideos.find((v) => v.type === "Teaser");
  if (anyTeaser) return anyTeaser.key;

  // 5. Official clip/featurette
  const officialAny = youtubeVideos.find((v) => v.official);
  if (officialAny) return officialAny.key;

  // 6. First YouTube video found
  return youtubeVideos[0].key;
}

export const handler = async (event: any) => {
  logger.info("Starting movie video fetcher...");

  // 1. Fetch up to 100 movies where there's no video set yet.
  const { data: movies, error: fetchError } = await supabase
    .from("movies")
    .select("id, title")
    .is("video", null)
    .order("id", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error("Failed to query movies", { error: fetchError });
    throw fetchError;
  }

  if (!movies || movies.length === 0) {
    logger.info("No movies found with video = null. All caught up.");
    return { processed: 0 };
  }

  logger.info(`Found ${movies.length} movies to fetch videos for.`);

  let updatedCount = 0;
  let notFoundCount = 0;

  // 2. For each movie, fetch videos from TMDB and update Supabase
  for (const movie of movies) {
    try {
      const response = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}/videos`, {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          accept: "application/json",
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch videos from TMDB for movie ${movie.id} (${movie.title})`, {
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }

      const data = (await response.json()) as TmdbVideosResponse;
      const youtubeSlug = selectBestYoutubeSlug(data.results || []);

      if (youtubeSlug) {
        const { error: updateError } = await supabase
          .from("movies")
          .update({ video: youtubeSlug })
          .eq("id", movie.id);

        if (updateError) {
          logger.error(`Failed to update video column for movie ${movie.id}`, { error: updateError });
        } else {
          updatedCount++;
          logger.info(`Updated movie ${movie.id} (${movie.title}) with video slug: ${youtubeSlug}`);
        }
      } else {
        notFoundCount++;
        logger.info(`No YouTube video found for movie ${movie.id} (${movie.title})`);
      }
    } catch (err: any) {
      logger.error(`Error processing video for movie ${movie.id}`, { err });
    }
  }

  logger.info("Finished batch movie video fetcher run", {
    totalQueried: movies.length,
    updatedCount,
    notFoundCount,
  });

  return {
    processed: movies.length,
    updated: updatedCount,
    notFound: notFoundCount,
  };
};

