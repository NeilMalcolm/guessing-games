import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$lib/utils/gameLogic', () => ({
	mapGameSessionToClientResponse: vi.fn((session, movie) => ({
		guesses: [],
		gameStatus: session.status,
		targetMovie: session.status === 'in_progress' ? null : { title: movie.title, videoUrl: '' }
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

function createBrokenJsonEvent(userId: string = 'user-1') {
	return {
		request: {
			json: async () => {
				throw new SyntaxError('Unexpected token in JSON');
			}
		},
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

describe('POST /movies/guess', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
		vi.mocked(mapGameSessionToClientResponse).mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects unparseable or broken JSON body with 400', async () => {
		await expect(POST(createBrokenJsonEvent())).rejects.toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('Invalid guessedMovieId') }
		});
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it.each([
		['empty body', {}],
		['null body', null],
		['missing guessedMovieId', { date: '2026-10-12' }],
		['undefined guessedMovieId', { guessedMovieId: undefined, date: '2026-10-12' }],
		['null guessedMovieId', { guessedMovieId: null, date: '2026-10-12' }],
		['string non-number', { guessedMovieId: 'abc', date: '2026-10-12' }],
		['empty string', { guessedMovieId: '', date: '2026-10-12' }],
		['whitespace string', { guessedMovieId: '   ', date: '2026-10-12' }],
		['boolean true', { guessedMovieId: true, date: '2026-10-12' }],
		['boolean false', { guessedMovieId: false, date: '2026-10-12' }],
		['zero', { guessedMovieId: 0, date: '2026-10-12' }],
		['negative integer', { guessedMovieId: -5, date: '2026-10-12' }],
		['float', { guessedMovieId: 1.5, date: '2026-10-12' }],
		['array', { guessedMovieId: [1], date: '2026-10-12' }],
		['object', { guessedMovieId: { id: 1 }, date: '2026-10-12' }]
	])('rejects invalid guessedMovieId (%s) with 400', async (_, body) => {
		await expect(POST(createEvent(body))).rejects.toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('Invalid guessedMovieId') }
		});
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it.each(['not-a-date', '2026-1-1', '2026-10-11T00:00:00Z'])(
		'rejects malformed date %j with 400',
		async (date) => {
			await expect(POST(createEvent({ guessedMovieId: 1, date }))).rejects.toMatchObject({ status: 400 });
		}
	);

	it.each(['2026-10-13', '2027-01-01'])(
		'rejects future date %s with 400',
		async (date) => {
			await expect(POST(createEvent({ guessedMovieId: 1, date }))).rejects.toMatchObject({ status: 400 });
			expect(supabaseAdmin.from).not.toHaveBeenCalled();
		}
	);

	it('rejects with 404 if daily movie is not found', async () => {
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

		await expect(POST(createEvent({ guessedMovieId: 1, date: '2026-10-12' }))).rejects.toMatchObject({
			status: 404,
			body: { message: expect.stringContaining('No daily movie found') }
		});
	});

	it('rejects with 404 if guessed movie is not found in movies table', async () => {
		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
						})
					})
				} as any;
			}
			if (table === 'movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: null, error: { message: 'Not found' } })
						})
					})
				} as any;
			}
			return {} as any;
		});

		await expect(POST(createEvent({ guessedMovieId: 999, date: '2026-10-12' }))).rejects.toMatchObject({
			status: 404,
			body: { message: expect.stringContaining('Movie not found') }
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
								single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
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

			await expect(POST(createEvent({ guessedMovieId: 10, date: '2026-10-12' }))).rejects.toMatchObject({
				status: 400,
				body: { message: expect.stringContaining(`already finished with status: ${status}`) }
			});
		}
	);

	it('rejects with 400 if movie was already guessed in this session', async () => {
		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
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
								maybeSingle: async () => ({
									data: {
										id: 'session-123',
										user_id: 'user-1',
										target_movie_id: 99,
										status: 'in_progress',
										max_attempts: 6,
										guesses: [{ movie_id: 10, movie: { id: 10 } }]
									}
								})
							})
						})
					})
				} as any;
			}
			return {} as any;
		});

		await expect(POST(createEvent({ guessedMovieId: 10, date: '2026-10-12' }))).rejects.toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('already been guessed') }
		});
	});

	it('rejects with 400 if max attempts already reached', async () => {
		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
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
								maybeSingle: async () => ({
									data: {
										id: 'session-123',
										user_id: 'user-1',
										target_movie_id: 99,
										status: 'in_progress',
										max_attempts: 2,
										guesses: [
											{ movie_id: 1, movie: { id: 1 } },
											{ movie_id: 2, movie: { id: 2 } }
										]
									}
								})
							})
						})
					})
				} as any;
			}
			return {} as any;
		});

		await expect(POST(createEvent({ guessedMovieId: 10, date: '2026-10-12' }))).rejects.toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('Maximum guess attempts reached') }
		});
	});

	it('updates status to won when the guessed movie matches the target movie', async () => {
		const updateMock = vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ error: null })
			})
		});
		const insertGuessMock = vi.fn().mockReturnValue({
			select: () => ({
				single: async () => ({ data: { id: 'guess-1' }, error: null })
			})
		});

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
						})
					})
				} as any;
			}
			if (table === 'movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { id: 99, title: 'Target' } })
						})
					})
				} as any;
			}
			if (table === 'guesses') {
				return { insert: insertGuessMock } as any;
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
								}),
								single: async () => ({
									data: {
										id: 'session-123',
										user_id: 'user-1',
										target_movie_id: 99,
										status: 'won',
										max_attempts: 6,
										guesses: [{ movie_id: 99, is_correct: true }]
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

		const response = await POST(createEvent({ guessedMovieId: 99, date: '2026-10-12' }));
		expect(response.status).toBe(200);

		expect(insertGuessMock).toHaveBeenCalledWith(
			expect.objectContaining({
				guess_number: 1,
				is_correct: true,
				movie_id: 99
			})
		);
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'won'
			})
		);
	});

	it('updates status to lost when reaching max attempts without matching', async () => {
		const updateMock = vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				eq: vi.fn().mockResolvedValue({ error: null })
			})
		});
		const insertGuessMock = vi.fn().mockReturnValue({
			select: () => ({
				single: async () => ({ data: { id: 'guess-2' }, error: null })
			})
		});

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: { id: 99, title: 'Target' } } })
						})
					})
				} as any;
			}
			if (table === 'movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { id: 10, title: 'Wrong Movie' } })
						})
					})
				} as any;
			}
			if (table === 'guesses') {
				return { insert: insertGuessMock } as any;
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
										max_attempts: 2,
										guesses: [{ movie_id: 5, movie: { id: 5 } }]
									}
								}),
								single: async () => ({
									data: {
										id: 'session-123',
										user_id: 'user-1',
										target_movie_id: 99,
										status: 'lost',
										max_attempts: 2,
										guesses: [
											{ movie_id: 5, is_correct: false },
											{ movie_id: 10, is_correct: false }
										]
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

		const response = await POST(createEvent({ guessedMovieId: 10, date: '2026-10-12' }));
		expect(response.status).toBe(200);

		expect(insertGuessMock).toHaveBeenCalledWith(
			expect.objectContaining({
				guess_number: 2,
				is_correct: false,
				movie_id: 10
			})
		);
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'lost'
			})
		);
	});
});
