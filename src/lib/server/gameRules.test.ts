import { describe, it, expect } from 'vitest';
import { assertCanGuess, calculateNextStatus, handleAtomicRecordError } from './gameRules';
import type { GameSessionResponse } from '$lib/types/supabasetables';

function createSession(overrides: Partial<GameSessionResponse> = {}): GameSessionResponse {
	return {
		id: 'session-1',
		user_id: 'user-1',
		target_movie_id: 100,
		status: 'in_progress',
		max_attempts: 6,
		created_at: '2026-10-12T00:00:00Z',
		updated_at: '2026-10-12T00:00:00Z',
		guesses: [],
		...overrides
	};
}

describe('gameRules', () => {
	describe('assertCanGuess', () => {
		it('allows valid guess on in-progress session with available attempts', () => {
			const session = createSession({
				guesses: [
					{
						id: 'g1',
						guess_number: 1,
						movie_id: 1,
						is_correct: false,
						created_at: '',
						movie: { id: 1 } as any
					}
				]
			});
			expect(() => assertCanGuess(session, 2)).not.toThrow();
		});

		it.each(['won', 'lost', 'gave_up'] as const)('rejects if session status is %s', (status) => {
			const session = createSession({ status });
			expect(() => assertCanGuess(session, 1)).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining(`already finished with status: ${status}`) }
				})
			);
		});

		it('rejects if guess count equals or exceeds max_attempts', () => {
			const session = createSession({
				max_attempts: 2,
				guesses: [
					{
						id: 'g1',
						guess_number: 1,
						movie_id: 1,
						is_correct: false,
						created_at: '',
						movie: { id: 1 } as any
					},
					{
						id: 'g2',
						guess_number: 2,
						movie_id: 2,
						is_correct: false,
						created_at: '',
						movie: { id: 2 } as any
					}
				]
			});
			expect(() => assertCanGuess(session, 3)).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('Maximum guess attempts reached') }
				})
			);
		});

		it('rejects if movie was already guessed (by movie_id)', () => {
			const session = createSession({
				guesses: [
					{
						id: 'g1',
						guess_number: 1,
						movie_id: 42,
						is_correct: false,
						created_at: '',
						movie: { id: 42 } as any
					}
				]
			});
			expect(() => assertCanGuess(session, 42)).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('already been guessed') }
				})
			);
		});

		it('rejects if movie was already guessed (by joined movie.id)', () => {
			const session = createSession({
				guesses: [
					{ id: 'g1', guess_number: 1, is_correct: false, created_at: '', movie: { id: 42 } as any }
				]
			});
			expect(() => assertCanGuess(session, 42)).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('already been guessed') }
				})
			);
		});
	});

	describe('calculateNextStatus', () => {
		it('returns won when guess is correct even if on first attempt', () => {
			expect(calculateNextStatus(true, 1, 6)).toBe('won');
		});

		it('returns won when guess is correct on last attempt', () => {
			expect(calculateNextStatus(true, 6, 6)).toBe('won');
		});

		it('returns lost when incorrect and reaching max attempts', () => {
			expect(calculateNextStatus(false, 6, 6)).toBe('lost');
		});

		it('returns in_progress when incorrect and attempts remain', () => {
			expect(calculateNextStatus(false, 3, 6)).toBe('in_progress');
		});
	});

	describe('handleAtomicRecordError', () => {
		it('translates ALREADY_GUESSED error to 400', () => {
			expect(() =>
				handleAtomicRecordError({
					error: 'ALREADY_GUESSED',
					message: 'Movie has already been guessed in this session'
				})
			).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('already been guessed') }
				})
			);
		});

		it('translates CONCURRENT_GUESS error to 400', () => {
			expect(() =>
				handleAtomicRecordError({
					error: 'CONCURRENT_GUESS',
					message: 'A guess was already recorded for this attempt. Please refresh.'
				})
			).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('already recorded for this attempt') }
				})
			);
		});

		it('translates SESSION_ALREADY_FINISHED error to 400', () => {
			expect(() =>
				handleAtomicRecordError({
					error: 'SESSION_ALREADY_FINISHED',
					message: 'Game session is already finished with status: won'
				})
			).toThrow(
				expect.objectContaining({
					status: 400,
					body: { message: expect.stringContaining('already finished with status: won') }
				})
			);
		});

		it('translates SESSION_NOT_FOUND error to 404', () => {
			expect(() =>
				handleAtomicRecordError({
					error: 'SESSION_NOT_FOUND',
					message: 'Game session not found'
				})
			).toThrow(
				expect.objectContaining({
					status: 404,
					body: { message: expect.stringContaining('Game session not found') }
				})
			);
		});

		it('translates other errors to 500', () => {
			expect(() =>
				handleAtomicRecordError({
					error: 'DATABASE_ERROR',
					message: 'relation does not exist'
				})
			).toThrow(
				expect.objectContaining({
					status: 500,
					body: { message: expect.stringContaining('relation does not exist') }
				})
			);
		});
	});
});
