import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$lib/utils/gameLogic', () => ({ mapGameSessionToClientResponse: vi.fn() }));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { POST } from './+server';

const NOW = new Date('2026-10-12T12:00:00Z');

function post(body: unknown) {
	const event: any = {
		request: { json: async () => body },
		locals: {}
	};
	return POST(event);
}

describe('POST /movies/guess date handling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each(['not-a-date', '2026-1-1', '2026-10-11T00:00:00Z'])(
		'rejects malformed date %j with 400',
		async (date) => {
			await expect(post({ guessedMovieId: 1, date })).rejects.toMatchObject({ status: 400 });
		}
	);

	it.each(['2026-10-13', '2027-01-01'])('rejects future date %s with 400', async (date) => {
		await expect(post({ guessedMovieId: 1, date })).rejects.toMatchObject({ status: 400 });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('rejects with 403 if game session belongs to a different user', async () => {
		const mockEvent: any = {
			request: { json: async () => ({ guessedMovieId: 10, date: '2026-10-12' }) },
			locals: {
				safeGetSession: vi.fn().mockResolvedValue({
					user: { id: 'user-1' },
					session: { user: { id: 'user-1' } }
				})
			}
		};

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99 } } })
						})
					})
				} as any;
			}
			if (table === 'movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { id: 10, title: 'Guessed Movie' } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								// Return session that belongs to someone else
								maybeSingle: async () => ({
									data: {
										id: 'session-123',
										user_id: 'different-user',
										target_movie_id: 99,
										status: 'in_progress',
										max_attempts: 6,
										guesses: []
									}
								})
							})
						})
					})
				} as any;
			}
			return {} as any;
		});

		await expect(POST(mockEvent)).rejects.toMatchObject({
			status: 403,
			body: { message: expect.stringContaining('does not belong to authenticated user') }
		});
	});
});


