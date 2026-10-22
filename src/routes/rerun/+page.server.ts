import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { PUBLIC_TMDB_THUMB_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { dailyMoviesTable, type GameSessionStatus } from '$lib/types/supabasetables';

export const load: PageServerLoad = async ({ locals }) => {
    const today = new Date().toISOString().split('T')[0];
    const { user } = await locals.safeGetSession();

    // When there is no user session, they have no game sessions.
    // Query daily movies without joining game session data.
    if (!user) {
        const { data, error: dbError } = await supabaseAdmin
            .from(dailyMoviesTable)
            .select('play_date')
            .lt('play_date', today)
            .order('play_date', { ascending: false });

        if (dbError) error(500, dbError.message);

        return {
            rerunDays: (data ?? []).map(({ play_date }) => ({
                playDate: play_date,
                status: null,
                poster: null
            }))
        };
    }

    // Get all daily movies (up to today) and, where it exists, the current
    // user's game session for each. Left join: unplayed dates still return.
    const { data, error: dbError } = await supabaseAdmin
        .from(dailyMoviesTable)
        .select(`
            play_date,
            movie:movies (
              poster_path,
              game_sessions ( status )
            )
        `)
        .lt('play_date', today)
        .order('play_date', { ascending: false })
        .eq('movie.game_sessions.user_id', user.id);

    if (dbError) error(500, dbError.message);

    // Only reveal the poster once the game is finished (won/lost/gave_up), otherwise
    // it would spoil the answer.
    const rerunDays = data.map(({ play_date, movie }) => {
        const status = (movie?.game_sessions[0]?.status ?? null) as GameSessionStatus | null;
        const finished = status === 'won' || status === 'lost' || status === 'gave_up';
        return {
            playDate: play_date,
            status,
            poster: finished && movie?.poster_path ? `${PUBLIC_TMDB_THUMB_URL}${movie.poster_path}` : null
        };
    });

    return { rerunDays };
};
