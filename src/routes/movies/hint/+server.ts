import { json } from '@sveltejs/kit';
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { logger } from '@sentry/sveltekit';
import type { GameSessionHint, MovieHints } from '$lib/types/supabasetables';
import { HINT_TYPES } from '$lib/types/supabasetables';

/**
 * GET endpoint will return the available hint categories to the user based on the movie 
 * and any hints they have used.
 * @param url the request itself, expects a game_session_id
 * @param locals app locals
 * @returns list of hint options
 */
 export const GET: RequestHandler = async ({ url, locals }) => {
    // game_session
     let gameSessionId = url.searchParams.get('gid');
 
     if (!gameSessionId) {
        logger.error(`No gameSessionId in query`);
        return json({ results: [] }, { status: 400 });
     }
     
     const { session, user } = await locals.safeGetSession();

     if (!user?.id) {
        logger.error(`Could not get user during hint fetch ${gameSessionId}`);
        return json({ results: [] }, { status: 400 });
     }
     
    const { data, error } = await supabaseAdmin
     .from('game_sessions')
     .select(
        `
        id,
        user_id,
        session_hints: game_session_hints(
            id,
            game_id,
            hint_type,
            unlocked_at_guess,
            created_at
        )
        `
     )
     .eq('id', gameSessionId)
     .eq('user_id', user.id)
     .single();

     
     if (error) {
        logger.error(`Error fetching game session during hint GET`, 
            { 
                session: session, 
                user: user, 
                error: error
            });

        return json({ results: [] }, { status: 500 });
     }

     const availableHints = getHintsFromSessionHints(data.session_hints);

     return json({
        availableHints
     });
}

function getHintsFromSessionHints(hints: { hint_type: string }[]): HintResponse[]  {
    return HINT_TYPES.map(hintType => ({
        hintType: hintType,
        used: hints.some((h) => h.hint_type == hintType)
    }));
}

export interface HintResponse {
    hintType: string,
    used: boolean
}


/**
 * POST endpoint will retrieve the hint for the current game session
 * @param request 
 * @param locals 
 */
export const POST: RequestHandler = async ({ request, locals }) => {

    return json('');
}