import { json, error as jsonError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { GAME_STATUS_IN_PROGRESS, HINT_TYPES, type HintType } from '$lib/types/supabasetables';
import { parseAndValidatePlayDate, getRequiredDailyMovie, getGameSession } from '$lib/server/gameSession';
import { getHintValue, getUnlockedHintCount, mapGameSessionToClientResponse } from '$lib/utils/gameLogic';

/**
 * POST endpoint will retrieve the hint for the current game session
 * @param request 
 * @param locals 
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const body = await request.json().catch(() => ({}));
    const playDate = parseAndValidatePlayDate(body?.date);
    const hint = body.hint;

    if (typeof hint !== 'string' || !HINT_TYPES.includes(hint as HintType)) {
        throw jsonError(400, 'Invalid hint type');
    }
    const chosenHint = hint as HintType;

    const dailyMovie = await getRequiredDailyMovie(playDate);

    if (!dailyMovie) {
        throw jsonError(500, 'Could not find movie.');
    }

    if (!dailyMovie.hints) {
        throw jsonError(500, 'No hints available');
    }
    
    const { user } = await locals.safeGetSession();

    if (!user) {
        throw jsonError(401, 'Could not find user.');
    }

    let gameSession = await getGameSession(user.id, dailyMovie.id);

    if (!gameSession) {
        throw jsonError(400, 'Could not find game.');
    }

    if (gameSession.status !== GAME_STATUS_IN_PROGRESS) {
        throw jsonError(400, 'Cannot get hint for a finished game.');
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

    const hintValue = getHintValue(dailyMovie.hints, chosenHint);
    if (!hintValue) {
        throw jsonError(404, 'Hint not available for this movie');
    }

    // Store the hint usage in the database
    let result = await supabaseAdmin
        .from('game_session_hints')
        .insert({
            game_id: gameSession.id,
            hint_type: chosenHint,
            unlocked_at_guess: gameSession.guesses.length,
            created_at: new Date().toISOString(),
        });

    // any error storing the hint usage in the DB should result in an error
    // surfacing and the hint not being returned. 
    if (result.error) {
        throw jsonError(500, 'Unexpected error occurred');
    }

    // Get fresh game session
    gameSession = await getGameSession(user.id, dailyMovie.id);
    if (!gameSession) {
        throw jsonError(400, 'Could not find game.');
    }

    return json(mapGameSessionToClientResponse(gameSession, dailyMovie));
}