import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { dailyMoviesTable, gamesSessionTable, type DailyMovieWithDetails, type GameSessionResponse } from '$lib/types/supabasetables';
import { generateGuessResponse } from '$lib/utils/gameLogic';
import type { GuessResponse } from '$lib/types/guess';

export const load: PageServerLoad = async ({ locals }) => {
    // 1. Get user session
    const { user, session} = await locals.safeGetSession();
    // If no user, they haven't guessed yet, return empty
    if (!user) {
        console.log('no user, returning []');
        return { guesses: [], gameStatus: 'in_progress' };
    }

    // 2. Get today's movie
    const today = new Date().toISOString().split('T')[0]; 
    console.log(`today's date ${today}`);
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

    const dailyMovie = dailyData?.movie;
    if (!dailyMovie) {
        console.log('no daily movie, returning []');
        return { guesses: [], gameStatus: 'in_progress' };
    }

    // 3. Get game session
    const { data: gameSessionData } = await supabaseAdmin
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
        .eq('target_movie_id', dailyMovie.id)
        .maybeSingle<GameSessionResponse>();

    if (!gameSessionData || !gameSessionData.guesses) {
        console.log('no gameSessionData, returning []');
        return { guesses: [], gameStatus: 'in_progress' };
    }

    console.log(gameSessionData);
    // 4. Map guesses to GuessResponse[]
    // Ensure the guesses are sorted by guess_number desc so they display 
    // in order of newest to oldest
    const sortedGuesses = 
        [...gameSessionData.guesses]
        .sort((a, z) => z.guess_number - a.guess_number);

    const mappedGuesses = sortedGuesses.map(guessRecord => {
        if (!guessRecord.movie) return null;
        return generateGuessResponse(
            guessRecord.movie, 
            dailyMovie, 
            guessRecord.is_correct, 
            gameSessionData.status
        );
    }).filter(Boolean) as GuessResponse[];

    return { 
        guesses: mappedGuesses, 
        gameStatus: gameSessionData.status 
    };
};
