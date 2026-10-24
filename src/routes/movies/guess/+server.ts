import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { json, error as jsonError } from '@sveltejs/kit';
import type { Movie, GameSessionResponse } from '$lib/types/supabasetables';
import { mapGameSessionToClientResponse } from '$lib/utils/gameLogic';
import {
	parseAndValidatePlayDate,
	getRequiredDailyMovie,
	getOrCreateUser,
	getOrCreateGameSession,
	reloadGameSession
} from '$lib/server/gameSession';
import {
	assertCanGuess,
	calculateNextStatus,
	handleAtomicRecordError
} from '$lib/server/gameRules';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => ({}));
	const rawId = body?.guessedMovieId;
	const guessedMovieId =
		typeof rawId === 'number'
			? rawId
			: typeof rawId === 'string' && rawId.trim() !== ''
				? Number(rawId)
				: NaN;

	if (!Number.isInteger(guessedMovieId) || guessedMovieId <= 0) {
		throw jsonError(400, 'Invalid guessedMovieId');
	}

	const playDate = parseAndValidatePlayDate(body?.date);

	// get today's movie
	console.log(`guessed movie ${guessedMovieId}`);
	const dailyMovie = await getRequiredDailyMovie(playDate);

	const { data: guessMovieDetails, error: guessMovieError } = await supabaseAdmin
		.from('movies')
		.select('*')
		.eq('id', guessedMovieId)
		.single<Movie>();

	if (guessMovieError || !guessMovieDetails) {
		throw jsonError(404, 'Movie not found');
	}

	const gameSession = await addGuessToDatabase(guessMovieDetails, dailyMovie, locals);
	const clientResponse = mapGameSessionToClientResponse(gameSession, dailyMovie);
	console.log(clientResponse);
	return json(clientResponse);
};

interface RecordGuessAtomicResult {
	success: boolean;
	error?: string;
	message?: string;
	guess_id?: string;
}

async function addGuessToDatabase(
	guessedMovie: Movie,
	targetMovie: Movie,
	locals: App.Locals
): Promise<GameSessionResponse> {
	if (!guessedMovie || !guessedMovie.id) {
		throw jsonError(400, 'Invalid movie details');
	}

	const user = await getOrCreateUser(locals);
	const gameSession = await getOrCreateGameSession(user.id, targetMovie.id);

	// 1. Evaluate business rules in TypeScript
	assertCanGuess(gameSession, guessedMovie.id);

	const nextGuessNumber = (gameSession.guesses ?? []).length + 1;
	const isCorrect = guessedMovie.id === targetMovie.id;
	const newStatus = calculateNextStatus(isCorrect, nextGuessNumber, gameSession.max_attempts);

	// 2. Perform atomic insert & status update in a single DB transaction
	const { data: rpcResponse, error: rpcError } = await supabaseAdmin.rpc('record_guess_atomic', {
		p_game_id: gameSession.id,
		p_user_id: user.id,
		p_movie_id: guessedMovie.id,
		p_guess_number: nextGuessNumber,
		p_is_correct: isCorrect,
		p_new_status: newStatus
	});

	if (rpcError) {
		console.error('Failed to execute record_guess_atomic RPC:', rpcError);
		throw jsonError(500, 'Failed to save guess');
	}

	const result = rpcResponse as unknown as RecordGuessAtomicResult | null;

	if (!result || !result.success) {
		handleAtomicRecordError(result || { message: 'Failed to record guess' });
	}

	return reloadGameSession(gameSession.id, user.id);
}
