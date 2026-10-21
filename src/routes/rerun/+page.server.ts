import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { PUBLIC_TMDB_THUMB_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { dailyMoviesTable, type GameSessionStatus } from '$lib/types/supabasetables';

export const load: PageServerLoad = async ({ locals }) => {
    const today = new Date().toISOString().split('T')[0];
    const { user } = await locals.safeGetSession();

    // Get all daily movies (up to today) and, where it exists, the current
    // user's game session for each. Left join: unplayed dates still return.
    let query = supabaseAdmin
        .from(dailyMoviesTable)
        .select(`
            play_date,
            movie:movies (
              poster_path,
              game_sessions ( status )
            )
        `)
        .lt('play_date', today)
        .order('play_date', { ascending: false });

    // No user means nothing played; the embedded sessions are then irrelevant.
    query = query.eq('movie.game_sessions.user_id', user?.id ?? '');

    const { data, error: dbError } = await query;
    if (dbError) error(500, dbError.message);

    // Only reveal the poster once the game is finished (won/lost), otherwise
    // it would spoil the answer.
    const rerunDays = data.map(({ play_date, movie }) => {
        const status = (movie?.game_sessions[0]?.status ?? null) as GameSessionStatus | null;
        const finished = status === 'won' || status === 'lost';
        return {
            playDate: play_date,
            status,
            poster: finished && movie?.poster_path ? `${PUBLIC_TMDB_THUMB_URL}${movie.poster_path}` : null
        };
    });

    return { rerunDays };
};
