import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/supabaseAdmin";
import { json, error as jsonError } from "@sveltejs/kit";
import type { Movie, GameSessionResponse, GameSessionStatus } from "$lib/types/supabasetables";
import { guessTable } from "$lib/types/supabasetables";
import { mapGameSessionToClientResponse } from "$lib/utils/gameLogic";
import {
  parseAndValidatePlayDate,
  getRequiredDailyMovie,
  getOrCreateUser,
  getOrCreateGameSession,
  updateGameSessionStatus,
  reloadGameSession
} from "$lib/server/gameSession";

export const POST: RequestHandler = async ({ request, locals }) => {
  const { guessedMovieId, date } = await request.json();
  const playDate = parseAndValidatePlayDate(date);

  // get today's movie
  console.log(`guessed movie ${guessedMovieId}`);
  const dailyMovie = await getRequiredDailyMovie(playDate);

  const { data: guessMovieDetails, error: guessMovieError } = await supabaseAdmin
    .from('movies')
    .select('*')
    .eq('id', guessedMovieId)
    .single<Movie>();

  if (guessMovieError || !guessMovieDetails) {
    console.log("return 500");
    return jsonError(404, "No value back for id");
  }

  const gameSession = await addGuessToDatabase(guessMovieDetails, dailyMovie, locals);
  const clientResponse = mapGameSessionToClientResponse(gameSession, dailyMovie);
  console.log(clientResponse);
  return json(clientResponse);
};

async function addGuessToDatabase(
  guessedMovie: Movie,
  targetMovie: Movie, 
  locals: any
): Promise<GameSessionResponse> { 
  if (!guessedMovie || !guessedMovie.id) {
    throw jsonError(400, "Invalid movie details");
  }

  const user = await getOrCreateUser(locals);
  const gameSession = await getOrCreateGameSession(user.id, targetMovie.id);

  // Ensure game session belongs to the authenticated user
  if (gameSession.user_id !== user.id) {
    throw jsonError(403, "Forbidden: Game session does not belong to authenticated user");
  }

  // Check if we've already finished or guessed this
  if (gameSession.status !== 'in_progress') {
    throw jsonError(400, `Game session is already finished with status: ${gameSession.status}`);
  }

  if ((gameSession.guesses ?? []).length >= gameSession.max_attempts) {
    throw jsonError(400, "Maximum guess attempts reached for this session");
  }

  const alreadyGuessed = (gameSession.guesses ?? []).some(
    (g) => g.movie?.id === guessedMovie.id || g.movie_id === guessedMovie.id
  );

  if (alreadyGuessed) {
    throw jsonError(400, "Movie has already been guessed in this session");
  }

  // add guess to guess table for this game session
  const nextGuessNumber = (gameSession.guesses ?? []).length + 1;
  const isCorrect = guessedMovie.id === targetMovie.id;

  const { data: newGuess, error: saveGuessError } = await supabaseAdmin
    .from(guessTable)
    .insert({
      game_id: gameSession.id,
      user_id: user.id,
      guess_number: nextGuessNumber,
      movie_id: guessedMovie.id,
      is_correct: isCorrect
    })
    .select()
    .single();

  if (saveGuessError || !newGuess) {
    console.error("Failed to save guess:", saveGuessError);
    throw jsonError(500, "Failed to save guess");
  }

  // Update game session status if won or lost
  let newStatus: GameSessionStatus = gameSession.status;
  if (isCorrect) {
    newStatus = 'won';
  } else if (nextGuessNumber >= gameSession.max_attempts) {
    newStatus = 'lost';
  }

  if (newStatus !== gameSession.status) {
    await updateGameSessionStatus(gameSession.id, user.id, newStatus);
  }

  return reloadGameSession(gameSession.id, user.id);
}
