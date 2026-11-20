import { json, error as jsonError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { logger } from '@sentry/sveltekit';
import { HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER, HINT_TYPE_TAGLINE, HINT_TYPES, type MovieHints } from '$lib/types/supabasetables';
import { parseAndValidatePlayDate, getRequiredDailyMovie, getGameSession } from '$lib/server/gameSession';
import { getUnlockedHintCount } from '$lib/utils/gameLogic';
import { PUBLIC_R2_IMAGE_URL } from '$env/static/public';
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
    const body = await request.json().catch(() => ({}));
    const playDate = parseAndValidatePlayDate(body?.date);
    const hint = body.hint;

    const dailyMovie = await getRequiredDailyMovie(playDate);

    if (!dailyMovie) {
        throw jsonError(500, 'Could not find movie.');
    }
    const { user } = await locals.safeGetSession();

    if (!user) {
        throw jsonError(401, 'Could not find user.');
    }

    const gameSession = await getGameSession(user.id, dailyMovie.id);

    if (!gameSession) {
        throw jsonError(400, 'Could not find game.');
    }

    let availableHints = getUnlockedHintCount(gameSession.guesses.length);

    // We cannot take a hint if there are no hints available, or we've already made more than
    // the available number of guesses.
    if (availableHints === 0 || (gameSession.taken_hints ?? []).length >= availableHints) {
        throw jsonError(400, 'Cannot make guess yet.');
    }

    // If we've used this hint, we cannot use it again.
    if (gameSession.taken_hints?.some(h => h.hint_type === hint)) {
        throw jsonError(500, 'Guess already used');
    }

    let hintValue = getHintValueFromHints(dailyMovie.hints as MovieHints, hint);
    
    return json({
        hintType: hint,
        hintValue: hintValue
    });
}

function getHintValueFromHints(movieHint: MovieHints, chosenHint: string) { 
    if (chosenHint === HINT_TYPE_KEYWORDS) {
        return movieHint.keywords;
    }
    else if (chosenHint === HINT_TYPE_POSTER) { 
        const url = new URL(PUBLIC_R2_IMAGE_URL);
        url.pathname += url.pathname.endsWith('/') ? '' : '/';
        return `${url}${movieHint.poster_key}.webp`;
    }
    else if (chosenHint === HINT_TYPE_TAGLINE) {
        return movieHint.tagline;
    }

    throw jsonError(500, 'Unexpected hint');
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

