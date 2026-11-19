import { createClient } from "@supabase/supabase-js";
import { Logger } from "@aws-lambda-powertools/logger";
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const logger = new Logger({ serviceName: 'movie-hint-fetcher' });
const ImageUploadContentType: string = "image/webp";

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const BATCH_SIZE = 30;

// Cloudflare R2 client 
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface TmdbHintResult {
  id: string,
  poster_path: string;
  tagline: string;
  keywords: KeywordCollection;
}

interface KeywordCollection {
  keywords: Keyword[];
}

interface Keyword { 
    id: string,
    name: string 
}

interface MoviesResult {
    id: number
}

/**
 * Retrieves a batch of movies from our system's movies table. 
 * @returns an array of MovieResult objects containing the id of the movies in this batch. 
 */
async function getMovieBatchFromDatabase() : Promise<MoviesResult[]> {

    // batch of movies without any hints
    const { data: movies, error: fetchError } = await supabase
        .from("movies")
        .select("id, hint:movie_hints(movie_id)")
        .is("hint", null)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

    if (fetchError) {
        logger.error("Failed to query movies", { error: fetchError });
        throw fetchError;
    }

    return (movies ?? []).map(m => 
    ({ 
        id: m.id 
    }));
}

/**
 * Fetches the movie hint details from the TMDB API. 
 * @param movie the movie from our system to be queried for against the TMDB API. 
 * @returns an object containing the necessary data. Includes keywords, tagline and poster.
 */
async function getMovieHintFromTmdbApi(movie: MoviesResult): Promise<TmdbHintResult> {
  const response = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}?append_to_response=keywords`, {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          accept: "application/json"
        }
      });
  
  if (!response.ok) {
    throw new Error(`Failed to retrieve hint data from TMDB API for '${movie.id}': ${response.status}`);
  }

  let rawResponse = await response.json();
  return rawResponse as TmdbHintResult;
}

/**
 * 
 * @param hint pixelates the poster path within the given hint data. 
 * @returns a raw buffer of the image, downsized, in webp format.
 */
async function pixelatePosterForHint(hint: TmdbHintResult) : Promise<Buffer> {
  const response = await fetch(`https://image.tmdb.org/t/p/w342${hint.poster_path}`);

  if (!response.ok) {
    throw new Error(`Failed to retrieve poster data for '${hint.poster_path}': ${response.status}`);
  }

  const rawImageData = Buffer.from(await response.arrayBuffer());

  return sharp(rawImageData)
    .resize(20, 30, { fit : "fill" })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Handles writing the hint data to the movie_hints table.
 * @param hint the hint data from the TMDB API.
 * @param pixelatedKey the key used to uniquely identify a pixelated image in R2. 
 */
async function writeHintToDatabase(hint: TmdbHintResult, pixelatedImageKey: string) {
    const { error } = await supabase
        .from('movie_hints')
        .upsert({
            movie_id: hint.id,
            poster_key: pixelatedImageKey,
            keywords: hint.keywords.keywords.map((m) => m.name),
            tagline: hint.tagline
        });

    if (error)
    {
      logger.error(`Error occurred when writing hint to database for movie ${hint.id}`, ({ error: error }));
      throw error;
    }
}

/**
 * Handles uploading the raw image buffer to the the Cloudflare R2 bucket.
 * @param pixelatedPosterBuffer the buffer containing the raw image data.
 * @param key the unique identifier for the image.
 * @param contentType the content type of the image.
 */
async function uploadToR2Bucket(pixelatedPosterBuffer: Buffer, key: string, contentType: string) {
    await r2Client.send(
      new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: `posters/${key}.webp`,
          Body: pixelatedPosterBuffer,
          ContentType: contentType
      })
    );
}

function createRandomIdForPixelatedPosterPath(): string {
    return crypto.randomUUID().toString();
}

export const handler = async (event: any) => {
    logger.info("Starting movie hint fetcher...");

    // 1. Fetch the batch of movies without hints from the database.
    const movieBatch = await getMovieBatchFromDatabase();

    // 2. For each movie, fetch the results, pixelate the poster, upload to R2 
    // and write hint to database.
    for (const movie of movieBatch) {
        // 2a. Fetch the required hint data from the TMDB API
        const hint = await getMovieHintFromTmdbApi(movie);

        if (!hint.poster_path) {
          logger.warn(`No poster path found for movie ${movie.id}`);
          return;
        }

        logger.debug(`Got valid hint data for movie ${movie.id}`);
        
        // 2b. Pixelate poster and write to database.
        let pixelatedPosterBuffer = await pixelatePosterForHint(hint);
        let posterKey = createRandomIdForPixelatedPosterPath();

        logger.debug(`Uploading to database for movie ${movie.id}`);
        // 2c. Upload to R2
        let success = await uploadToR2Bucket(pixelatedPosterBuffer, 
          posterKey,
          ImageUploadContentType);

        logger.debug(`Writing to database for movie ${movie.id}`);
        // 2d. Write to database
        await writeHintToDatabase(hint, posterKey);
    };
};