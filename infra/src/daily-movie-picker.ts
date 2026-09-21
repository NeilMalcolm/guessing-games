import { createClient } from "@supabase/supabase-js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: 'daily-movie-picker' });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler = async (event: any) => {
  logger.info("Starting daily movie picker...");

  // 1. Fetch used movie IDs
  const { data: usedMovies, error: usedError } = await supabase
    .from('daily_movies')
    .select('movie_id');
    
  if (usedError) {
    logger.error("Failed to fetch used movies", { error: usedError });
    throw usedError;
  }
  
  const usedIds = new Set(usedMovies?.map(m => m.movie_id) || []);

  // 2. Fetch all available movie IDs
  const { data: allMovies, error: allMoviesError } = await supabase
    .from('movies')
    .select('id');

  if (allMoviesError) {
    logger.error("Failed to fetch all movies", { error: allMoviesError });
    throw allMoviesError;
  }

  const availableMovies = allMovies?.map(m => m.id)
    .filter(id => !usedIds.has(id)) || [];

  if (availableMovies.length === 0) {
    logger.error("No available unused movies left in the database!");
    return;
  }

  // 3. Pick a random movie
  const randomIndex = Math.floor(Math.random() * availableMovies.length);
  const selectedMovieId = availableMovies[randomIndex];
  
  logger.info(`Selected movie ID: ${selectedMovieId} from ${availableMovies.length} available movies.`);

  // 4. Calculate the play date for "tomorrow"
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const playDate = tomorrow.toISOString().split('T')[0];

  logger.info(`Setting play_date to ${playDate}`);

  // 5. Insert into daily_movies
  const { error: insertError } = await supabase.from('daily_movies').insert({
    play_date: playDate,
    movie_id: selectedMovieId,
    custom_hints: {}
  });

  if (insertError) {
    logger.error("Failed to insert daily movie", { error: insertError });
    throw insertError;
  }

  logger.info(`Successfully inserted daily movie for ${playDate}!`);
};

