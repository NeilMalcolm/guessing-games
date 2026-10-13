import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { dailyMoviesTable, gamesSessionTable, type DailyMovieWithDetails, type GameSessionResponse } from '$lib/types/supabasetables';
import { mapGameSessionToClientResponse } from '$lib/utils/gameLogic';

export const load: PageServerLoad = async ({ locals, params }) => {
    // default to today if no param is provided.
    const today = new Date().toISOString().split('T')[0];
    const playDate = params.date ?? today;

    // We won't support future dates.
    if (playDate > today) {
        error(404, 'Not found');
    }

    // 1. Get user session
    const { user } = await locals.safeGetSession();
    
    // If no user, they haven't guessed yet, return empty
    if (!user) {
        console.log('no user, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    // 2. Get today's movie
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
    if (!dailyMovie) {
        console.log('no daily movie, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    // 3. Get game session
    console.log(`find session for ${user.id}, movie=${dailyMovie.id}`);
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
        .eq('target_movie_id', dailyMovie.id)
        .maybeSingle<GameSessionResponse>();

    if (!gameSessionData || !gameSessionData.guesses) {
        console.log('no gameSessionData, returning []');
        return { guesses: [], gameStatus: 'in_progress', playDate };
    }

    console.log(`${gameSessionData.status}`);
    return { ...mapGameSessionToClientResponse(gameSessionData, dailyMovie), playDate };
};

