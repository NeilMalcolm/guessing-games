import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/supabaseAdmin";
import { tmdb } from "$lib/tmdbClient";
import { json, error as jsonError } from "@sveltejs/kit";
import type { DailyMovieWithDetails, Movie, GameSession, GameSessionResponse, GameSessionStatus, Guess } from "$lib/types/supabasetables";
import { dailyMoviesTable, guessTable, gamesSessionTable, moviesTable } from "$lib/types/supabasetables";
import { PUBLIC_TMDB_THUMB_URL } from "$env/static/public";
import type { TmdbGenre, TmdbMovieDetailResponse, TmdbMovieDetail } from "$lib/types/tmdb";
import { Match, type GuessResponse } from "$lib/types/guess";
import { generateGuessResponse } from "$lib/utils/gameLogic";

const AGE_MAPPING: Record<string, Record<string, number>> = {
  GB: { 'U': 0, 'PG': 8, '12': 12, '12A': 12, '15': 15, '18': 18, 'R18': 18 },
  US: { 'G': 0, 'PG': 8, 'PG-13': 13, 'R': 17, 'NC-17': 18, 'NR': 0 },
  DE: { '0': 0, '6': 6, '12': 12, '16': 16, '18': 18 }
};

function mapTmdbToMovie(guessedMovie: TmdbMovieDetail): Movie {
  const guessAge = extractAgeRating(guessedMovie.release_dates?.results);
  console.log("guessAge");
  console.log(guessAge);
  const guessMovieYear = guessedMovie.release_date 
    ? new Date(guessedMovie.release_date).getFullYear() 
    : null;

  return {
    id: guessedMovie.id,
    title: guessedMovie.title,
    release_year: guessMovieYear,
    poster_path: guessedMovie.poster_path ?? null,
    genres: (guessedMovie.genres ?? []).map((g: TmdbGenre) => g.name),
    director: guessedMovie.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null,
    popularity: guessedMovie.popularity ?? null,
    cast_members: (guessedMovie.credits?.cast ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      order: c.order,
      profile_path: c.profile_path ?? null
    })),
    box_office: guessedMovie.revenue ?? null,
    rating: guessedMovie.vote_average ?? null,
    vote_count: guessedMovie.vote_count ?? null,
    min_age: guessAge.minAge,
    certifications: guessAge.certs,
    cached_at: new Date().toISOString()
  };
}

async function addGuessToDatabase(
  guessedMovie: TmdbMovieDetailResponse, 
  targetMovie: Movie, 
  locals: App.Locals
): Promise<GameSessionResponse> { 

  if (!('id' in guessedMovie)) {
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
  
  const { data, error } = await locals.supabase
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
    const { data: newSession, error: createError } = await locals.supabase
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
      .single<GameSession>();

    if (createError || !newSession) {
      console.error("Failed to create game session:", createError);
      throw jsonError(500, "Failed to create game session");
    }

    gameSession = {
      ...newSession,
      guesses: []
    };
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

  const movieToSave = mapTmdbToMovie(guessedMovie as TmdbMovieDetail);

  await supabaseAdmin
    .from(moviesTable)
    .upsert(movieToSave, { onConflict: 'id' });

  // add guess to guess table for this game session
  const nextGuessNumber = (gameSession.guesses ?? []).length + 1;
  const isCorrect = guessedMovie.id === targetMovie.id;

  const { data: newGuess, error: saveGuessError } = await locals.supabase
    .from(guessTable)
    .insert({
      game_id: gameSession.id,
      user_id: user.id,
      guess_number: nextGuessNumber,
      movie_id: guessedMovie.id,
      is_correct: isCorrect
    })
    .select()
    .single<Guess>();

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
    const { error: updateError } = await locals.supabase
      .from(gamesSessionTable)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameSession.id);

    if (updateError) {
      console.error("Failed to update game session status:", updateError);
    }
    gameSession.status = newStatus;
  }

  return gameSession;
}

export const POST: RequestHandler = async ({ url, request, locals }) => {
    const today = new Date().toISOString().split('T')[0]; 
    const { guessedMovieId } = await request.json();

    // get today's movie
    console.log(`guessed movie ${guessedMovieId}`);
    const { data, error } = await supabaseAdmin
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
              popularity,
              cast_members,
              box_office,
              rating,
              min_age,
              certifications
            )
        `)
        .eq('play_date', today)
        .single<DailyMovieWithDetails>();

    const dailyMovie: Movie | undefined = data?.movie;
        
    if (!dailyMovie?.id) {
      console.log("return empty");
      return json([]);
    }

    let guessMovieDetails = await tmdb.getMovieDetails(guessedMovieId);

    console.log(`${guessMovieDetails.ok}`);
    if (!guessMovieDetails.ok) {
      console.log("return 500");
      return jsonError(500, "No value back for id");
    }

    const gameSession = await addGuessToDatabase(guessMovieDetails, dailyMovie, locals);
    const isCorrect = guessMovieDetails.id === dailyMovie.id;

    const guessMovieMapped = mapTmdbToMovie(guessMovieDetails as TmdbMovieDetail);
    const response = generateGuessResponse(guessMovieMapped, dailyMovie, isCorrect, gameSession.status);

    return json(response);
};

function formatCurrency(amount: number): string {
  if (!amount || amount === 0) return "$0";
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.?0+$/, "")}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

function extractAgeRating(releaseDatesResults?: { iso_3166_1: string; release_dates: { certification: string }[] }[]): { certLabel: string; minAge: number | null; certs: Record<string, string> } {
  if (!releaseDatesResults || releaseDatesResults.length === 0) {
    return { certLabel: "N/A", minAge: null, certs: {} };
  }

  const certs: Record<string, string> = {};
  for (const r of releaseDatesResults) {
    const cert = r.release_dates.find(d => d.certification?.trim())?.certification;
    if (cert) certs[r.iso_3166_1] = cert;
  }

  // Preference: GB, then US, then DE, or first available
  const certLabel = certs["GB"] ?? certs["US"] ?? certs["DE"] ?? Object.values(certs)[0] ?? "N/A";
  let minAge: number | null = null;

  if (certs["GB"] && AGE_MAPPING.GB[certs["GB"]] !== undefined) {
    minAge = AGE_MAPPING.GB[certs["GB"]];
  } else if (certs["US"] && AGE_MAPPING.US[certs["US"]] !== undefined) {
    minAge = AGE_MAPPING.US[certs["US"]];
  } else if (certs["DE"] && AGE_MAPPING.DE[certs["DE"]] !== undefined) {
    minAge = AGE_MAPPING.DE[certs["DE"]];
  }

  return { certLabel, minAge, certs };
}

function getGenreMatch(genre: string, genres: string[]): Match {
  return (genres ?? []).includes(genre) ? Match.Exact : Match.None;
}

function getNumberMatch(guess: number, target: number, threshold: number): Match {
  if (guess == target) return Match.Exact;

  let isClose = Math.abs(guess - target) <= threshold;

  if (guess > target) {
    return isClose ? Match.LowerClose : Match.Lower;
  }

  return isClose ? Match.HigherClose : Match.Higher;
}