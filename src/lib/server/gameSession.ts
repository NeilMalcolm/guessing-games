import { supabaseAdmin } from "$lib/supabaseAdmin";
import { error as jsonError } from "@sveltejs/kit";
import type { Movie, GameSessionResponse, GameSessionStatus, DailyMovieWithDetails } from "$lib/types/supabasetables";
import { dailyMoviesTable, gamesSessionTable } from "$lib/types/supabasetables";
import { isIsoDate } from "$lib/utils/playDate";
import type { User } from "@supabase/supabase-js";

/**
 * Validates and returns an ISO 8601 play date string (YYYY-MM-DD), defaulting to today if not provided.
 * Throws a 400 Bad Request error if the date format is invalid or in the future.
 */
export function parseAndValidatePlayDate(date: unknown): string {
  const today = new Date().toISOString().split('T')[0];
  const playDate = (typeof date === 'string' && date.length > 0)
    ? date
    : (date === undefined || date === null ? today : String(date));

  if (!isIsoDate(playDate) || playDate > today) {
    throw jsonError(400, "Invalid date");
  }

  return playDate;
}

export const DAILY_MOVIE_SELECT = `
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
`;

export const GAME_SESSION_SELECT = `
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
`;

/**
 * Retrieves the daily movie and its details for a given play date, or null if not found.
 */
export async function getDailyMovie(playDate: string): Promise<Movie | null> {
  const { data: dailyData } = await supabaseAdmin
    .from(dailyMoviesTable)
    .select(DAILY_MOVIE_SELECT)
    .eq('play_date', playDate)
    .single<DailyMovieWithDetails>();

  return dailyData?.movie ?? null;
}

/**
 * Retrieves the daily movie for a given play date, throwing 404 if not found.
 */
export async function getRequiredDailyMovie(playDate: string): Promise<Movie> {
  const dailyMovie = await getDailyMovie(playDate);
  if (!dailyMovie?.id) {
    throw jsonError(404, "No daily movie found for today");
  }
  return dailyMovie;
}

/**
 * Ensures an authenticated or anonymous user session is available from locals.
 */
export async function getOrCreateUser(locals: App.Locals): Promise<User> {
  let { session, user } = await locals.safeGetSession();
  if (!session) {
    const signInResult = await locals.supabase.auth.signInAnonymously();
    session = signInResult.data.session;
    user = signInResult.data.user;
  }

  if (!user) {
    throw jsonError(401, "No user found");
  }

  return user;
}

/**
 * Fetches the existing game session (with joined guesses and movies) for the given user and target movie.
 */
export async function getGameSession(
  userId: string,
  targetMovieId: number
): Promise<GameSessionResponse | null> {
  const { data, error } = await supabaseAdmin
    .from(gamesSessionTable)
    .select(GAME_SESSION_SELECT)
    .eq('user_id', userId)
    .eq('target_movie_id', targetMovieId)
    .maybeSingle<GameSessionResponse>();

  if (error) {
    console.error("Error fetching game session:", error);
    throw jsonError(500, "Failed to retrieve game session");
  }

  return data;
}

/**
 * Creates a new game session in the database for the given user and target movie.
 */
export async function createGameSession(
  userId: string,
  targetMovieId: number,
  status: GameSessionStatus = 'in_progress'
): Promise<GameSessionResponse> {
  const { data: newSession, error: createError } = await supabaseAdmin
    .from(gamesSessionTable)
    .insert({
      user_id: userId,
      target_movie_id: targetMovieId,
      status
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

  return {
    ...newSession,
    status: newSession.status as GameSessionStatus,
    guesses: []
  };
}

/**
 * Retrieves the game session or creates a new one in 'in_progress' status if not found.
 */
export async function getOrCreateGameSession(
  userId: string,
  targetMovieId: number
): Promise<GameSessionResponse> {
  let gameSession = await getGameSession(userId, targetMovieId);
  if (!gameSession) {
    gameSession = await createGameSession(userId, targetMovieId, 'in_progress');
  }
  return gameSession;
}

/**
 * Updates the game session status and updated_at timestamp in the database.
 */
export async function updateGameSessionStatus(
  sessionId: string,
  userId: string,
  status: GameSessionStatus
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from(gamesSessionTable)
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) {
    console.error("Failed to update game session status:", updateError);
    throw jsonError(500, "Failed to update game session status");
  }
}

/**
 * Reloads the full game session with all guesses and joined movie data by session id.
 */
export async function reloadGameSession(
  sessionId: string,
  userId: string
): Promise<GameSessionResponse> {
  const { data: reloadedSession, error: reloadError } = await supabaseAdmin
    .from(gamesSessionTable)
    .select(GAME_SESSION_SELECT)
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<GameSessionResponse>();

  if (reloadError || !reloadedSession) {
    console.error("Failed to reload game session:", reloadError);
    throw jsonError(500, "Failed to reload game session");
  }

  return reloadedSession;
}

