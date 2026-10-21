import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/supabaseAdmin";
import { json, error as jsonError } from "@sveltejs/kit";
import type { Movie, GameSessionResponse, GameSessionStatus, DailyMovieWithDetails } from "$lib/types/supabasetables";
import { dailyMoviesTable, guessTable, gamesSessionTable } from "$lib/types/supabasetables";
import { mapGameSessionToClientResponse } from "$lib/utils/gameLogic";
import { isIsoDate } from "$lib/utils/playDate";

export const POST: RequestHandler = async ({ request, locals }) => {
    const today = new Date().toISOString().split('T')[0];
    const { guessedMovieId, date } = await request.json();
    const playDate: string = date ?? today;
    if (!isIsoDate(playDate) || playDate > today) {
      return jsonError(400, "Invalid date");
    }

    // get today's movie
    console.log(`guessed movie ${guessedMovieId}`);
    const { data: dailyData } = await supabaseAdmin
        .from(dailyMoviesTable)
        .select(`
            play_date,
            custom_hints,
            movie:movies (
              id,
              title,
              release_year,
              poster_path,
              genres,
              director,
              director_profile_path,
              popularity,
              cast_members,
              box_office,
              rating,
              min_age,
              certifications,
              video
            )
        `)
        .eq('play_date', playDate)
        .single<DailyMovieWithDetails>();

    const dailyMovie = dailyData?.movie;
        
    if (!dailyMovie?.id) {
      console.log("return empty");
      return jsonError(404, "No daily movie found for today");
    }

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

  // 1. check for session
  //    1. a create if non-existant for today
  // 2. check if we've already guessed this,
  // 3. Save guess in database 
  
  let { session, user } = await locals.safeGetSession();
  if (!session)
  {
    let signInResult = await locals.supabase.auth.signInAnonymously();

    session = signInResult.data.session;
    user = signInResult.data.user;
  }

  if (!user) {
    throw jsonError(401, "No user found");
  }
  
  const { data, error } = await supabaseAdmin
    .from(gamesSessionTable)
    .select(`
        id,
        user_id,
        target_movie_id,
        status,
        max_attempts,
        created_at,
        updated_at,
        guesses: guesses (
          id,
          guess_number,
          movie_id,
          is_correct,
          created_at,
          movie: movies (
              id,
              title,
              release_year,
              poster_path,
              genres,
              director,
              director_profile_path,
              popularity,
              cast_members,
              box_office,
              rating,
              min_age,
              certifications
          )
        )
      `)
    .eq('user_id', user.id)
    .eq('target_movie_id', targetMovie.id)
    .maybeSingle<GameSessionResponse>();

  if (error) {
    console.error("Error fetching game session:", error);
    throw jsonError(500, "Failed to retrieve game session");
  }
    
  let gameSession: GameSessionResponse | null = data;
      
  if (!gameSession) {
    // 1. a create if non-existant for today
    const { data: newSession, error: createError } = await supabaseAdmin
      .from(gamesSessionTable)
      .insert({
        user_id: user.id,
        target_movie_id: targetMovie.id,
        status: 'in_progress'
      })
      .select(`
        id,
        user_id,
        target_movie_id,
        status,
        max_attempts,
        created_at,
        updated_at
      `)
      .single();

    if (createError || !newSession) {
      console.error("Failed to create game session:", createError);
      throw jsonError(500, "Failed to create game session");
    }

    gameSession = {
      ...newSession,
      status: newSession.status as GameSessionStatus, // DB column is plain text
      guesses: []
    };
  }

  if (!gameSession) {
    throw jsonError(500, "Game session is null after initialization");
  }

  // Ensure game session belongs to the authenticated user
  if (gameSession.user_id !== user.id) {
    throw jsonError(403, "Forbidden: Game session does not belong to authenticated user");
  }

  // 2. check if we've already guessed this,
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
    const { error: updateError } = await supabaseAdmin
      .from(gamesSessionTable)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameSession.id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Failed to update game session status:", updateError);
    }
  }

  // Reload the full game session with all guesses and joined movie data
  const { data: reloadedSession, error: reloadError } = await supabaseAdmin
    .from(gamesSessionTable)
    .select(`
        id,
        user_id,
        target_movie_id,
        status,
        max_attempts,
        created_at,
        updated_at,
        guesses: guesses (
          id,
          guess_number,
          movie_id,
          is_correct,
          created_at,
          movie: movies (
              id,
              title,
              release_year,
              poster_path,
              genres,
              director,
              director_profile_path,
              popularity,
              cast_members,
              box_office,
              rating,
              min_age,
              certifications
          )
        )
      `)
    .eq('id', gameSession.id)
    .eq('user_id', user.id)
    .single<GameSessionResponse>();

  if (reloadError || !reloadedSession) {
    console.error("Failed to reload game session:", reloadError);
    throw jsonError(500, "Failed to reload game session");
  }

  return reloadedSession;
}