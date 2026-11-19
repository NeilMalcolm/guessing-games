import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { logger } from '@sentry/sveltekit';
import { HINT_TYPES } from '$lib/types/supabasetables';
import { parseAndValidatePlayDate, getRequiredDailyMovie } from '$lib/server/gameSession';

/**
 * GET endpoint will return the available hint categories to the user based on the daily movie
 * and any hints they have used in their session.
 * @param url the request URL, optionally containing a `date` query param (YYYY-MM-DD, defaults to today)
 * @param locals app locals
 * @returns list of hint options
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    // Get the date from the query and fetch the daily_movie by the date.
	const playDate = parseAndValidatePlayDate(url.searchParams.get('date'));
	const dailyMovie = await getRequiredDailyMovie(playDate);

    // get user/session details
	const { session, user } = await locals.safeGetSession();

	if (!user?.id) {
		logger.error(`Could not get user during hint fetch for ${playDate}`);
		return json({ availableHints: [] }, { status: 400 });
	}

    // get the game session for this user for the movie.
	const { data, error } = await supabaseAdmin
		.from('game_sessions')
		.select(
			`
			id,
			user_id,
			target_movie_id,
			session_hints: game_session_hints(
				id,
				game_id,
				hint_type,
				unlocked_at_guess,
				created_at
			)
			`
		)
		.eq('user_id', user.id)
		.eq('target_movie_id', dailyMovie.id)
		.maybeSingle();

	if (error) {
		logger.error(`Error fetching game session during hint GET`, {
			session,
			user,
			error
		});

		return json({ availableHints: [] }, { status: 500 });
	}

    // return available hints to frontend
	const availableHints = getHintsFromSessionHints(data?.session_hints ?? []);

	return json({
		availableHints
	});
};

/**
 * POST endpoint will retrieve the hint for the current game session
 * @param request 
 * @param locals 
 */
export const POST: RequestHandler = async ({ request, locals }) => {

    return json('');
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

