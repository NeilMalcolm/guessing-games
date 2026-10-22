import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$lib/utils/gameLogic', () => ({
	mapGameSessionToClientResponse: vi.fn((session, movie) => ({
		guesses: [],
		gameStatus: session.status,
		targetMovie: { title: movie.title, videoUrl: `https://www.youtube.com/embed/${movie.video}` }
	}))
}));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { mapGameSessionToClientResponse } from '$lib/utils/gameLogic';
import { POST } from './+server';

const NOW = new Date('2026-10-12T12:00:00Z');

function createEvent(body: unknown, userId: string = 'user-1') {
	return {
		request: { json: async () => body },
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({
				user: { id: userId },
				session: { user: { id: userId } }
			}),
			supabase: {
				auth: {
					signInAnonymously: vi.fn().mockResolvedValue({
						data: { user: { id: userId }, session: { user: { id: userId } } }
					})
				}
			}
		}
	} as any;
}

describe('POST /movies/give-up', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
		vi.mocked(mapGameSessionToClientResponse).mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each(['not-a-date', '2026-1-1', '2026-10-11T00:00:00Z'])(
		'rejects malformed date %j with 400',
		async (date) => {
			await expect(POST(createEvent({ date }))).rejects.toMatchObject({ status: 400 });
		}
	);

	it.each(['2026-10-13', '2027-01-01'])(
		'rejects future date %s with 400',
		async (date) => {
			await expect(POST(createEvent({ date }))).rejects.toMatchObject({ status: 400 });
			expect(supabaseAdmin.from).not.toHaveBeenCalled();
		}
	);

	it('returns 404 if no daily movie is found for the given date', async () => {
		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: null })
						})
					})
				} as any;
			}
			return {} as any;
		});

		await expect(POST(createEvent({ date: '2026-10-12' }))).rejects.toMatchObject({
			status: 404,
			body: { message: expect.stringContaining('No daily movie found') }
		});
	});

	it('rejects with 403 if game session belongs to a different user', async () => {
		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target Movie' } } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
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

		await expect(POST(createEvent({ date: '2026-10-12' }, 'user-1'))).rejects.toMatchObject({
			status: 403,
			body: { message: expect.stringContaining('does not belong to authenticated user') }
		});
	});

	it.each(['won', 'lost', 'gave_up'])(
		'rejects with 400 if game session is already finished with status %s',
		async (status) => {
			vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
				if (table === 'daily_movies') {
					return {
						select: () => ({
							eq: () => ({
								single: async () => ({ data: { movie: { id: 99, title: 'Target Movie' } } })
							})
						})
					} as any;
				}
				if (table === 'game_sessions') {
					return {
						select: () => ({
							eq: () => ({
								eq: () => ({
									maybeSingle: async () => ({
										data: {
											id: 'session-123',
											user_id: 'user-1',
											target_movie_id: 99,
											status,
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

			await expect(POST(createEvent({ date: '2026-10-12' }, 'user-1'))).rejects.toMatchObject({
				status: 400,
				body: { message: expect.stringContaining(`already finished with status: ${status}`) }
			});
		}
	);

	it('updates existing in_progress game session to gave_up and returns GameSessionClientResponse', async () => {
		const targetMovie = { id: 99, title: 'The Matrix', video: 'm8e-679Chvg' };
		const updateMock = vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ error: null })
			})
		});

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: targetMovie } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								maybeSingle: async () => ({
									data: {
										id: 'session-123',
										user_id: 'user-1',
										target_movie_id: 99,
										status: 'in_progress',
										max_attempts: 6,
										guesses: []
									}
								})
							})
						})
					}),
					update: updateMock
				} as any;
			}
			return {} as any;
		});

		const response = await POST(createEvent({ date: '2026-10-12' }, 'user-1'));
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json.gameStatus).toBe('gave_up');
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'gave_up',
				updated_at: expect.any(String)
			})
		);
		expect(mapGameSessionToClientResponse).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'session-123', status: 'gave_up' }),
			targetMovie
		);
	});

	it('creates new session if none exists, updates status to gave_up, and returns GameSessionClientResponse', async () => {
		const targetMovie = { id: 99, title: 'The Matrix', video: 'm8e-679Chvg' };
		const updateMock = vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ error: null })
			})
		});
		const insertMock = vi.fn().mockReturnValue({
			select: () => ({
				single: async () => ({
					data: {
						id: 'new-session-456',
						user_id: 'user-1',
						target_movie_id: 99,
						status: 'in_progress',
						max_attempts: 6,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					},
					error: null
				})
			})
		});

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: targetMovie } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								maybeSingle: async () => ({ data: null, error: null })
							})
						})
					}),
					insert: insertMock,
					update: updateMock
				} as any;
			}
			return {} as any;
		});

		const response = await POST(createEvent({}, 'user-1'));
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json.gameStatus).toBe('gave_up');
		expect(insertMock).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: 'user-1',
				target_movie_id: 99,
				status: 'in_progress'
			})
		);
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'gave_up'
			})
		);
	});
});

