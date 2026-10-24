import { error as jsonError } from '@sveltejs/kit';
import type { GameSessionResponse, GameSessionStatus } from '$lib/types/supabasetables';

/**
 * Validates that a user can submit a guess for the given game session.
 * Throws a 400 Bad Request error if the session is finished, attempts are exhausted,
 * or the movie was already guessed.
 */
export function assertCanGuess(gameSession: GameSessionResponse, movieId: number): void {
	if (gameSession.status !== 'in_progress') {
		throw jsonError(400, `Game session is already finished with status: ${gameSession.status}`);
	}

	if ((gameSession.guesses ?? []).length >= gameSession.max_attempts) {
		throw jsonError(400, 'Maximum guess attempts reached for this session');
	}

	const alreadyGuessed = (gameSession.guesses ?? []).some(
		(g) => g.movie?.id === movieId || g.movie_id === movieId
	);

	if (alreadyGuessed) {
		throw jsonError(400, 'Movie has already been guessed in this session');
	}
}

/**
 * Calculates the next session status based on whether the guess was correct
 * and whether maximum attempts have been reached.
 */
export function calculateNextStatus(
	isCorrect: boolean,
	nextGuessNumber: number,
	maxAttempts: number
): GameSessionStatus {
	if (isCorrect) {
		return 'won';
	}
	if (nextGuessNumber >= maxAttempts) {
		return 'lost';
	}
	return 'in_progress';
}

/**
 * Handles errors returned by the record_guess_atomic RPC function,
 * translating concurrency / constraint errors into appropriate HTTP responses.
 */
export function handleAtomicRecordError(result: { error?: string; message?: string }): never {
	console.error('Failed to record guess atomically:', result);

	const message = result?.message || 'Failed to record guess';

	if (
		result?.error === 'SESSION_ALREADY_FINISHED' ||
		result?.error === 'ALREADY_GUESSED' ||
		result?.error === 'CONCURRENT_GUESS'
	) {
		throw jsonError(400, message);
	}

	if (result?.error === 'SESSION_NOT_FOUND') {
		throw jsonError(404, message);
	}

	throw jsonError(500, message);
}
