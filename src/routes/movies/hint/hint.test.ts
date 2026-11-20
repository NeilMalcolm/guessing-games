import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({
	supabaseAdmin: {
		from: vi.fn()
	}
}));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { buildPosterHintUrl } from '$lib/utils/gameLogic';
import { POST } from './+server';

const NOW = new Date('2026-10-12T12:00:00Z');

const defaultHints = {
	movie_id: 42,
	tagline: 'Your mind is the scene of the crime.',
	keywords: ['dream', 'subconscious', 'heist'],
	poster_key: 'inception-key',
	created_at: '2026-10-12T00:00:00Z',
	hints_fetched_at: '2026-10-12T00:00:00Z'
};

function createGuesses(count: number) {
	return Array.from({ length: count }, (_, idx) => ({
		id: `guess-${idx + 1}`,
		guess_number: idx + 1,
		movie_id: 100 + idx,
		is_correct: false,
		created_at: '2026-10-12T00:00:00Z'
	}));
}

function createEvent(body: unknown, userId: string | null = 'user-1') {
	return {
		request: new Request('http://example.com/movies/hint', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue(
				userId
					? {
							user: { id: userId },
							session: { user: { id: userId } }
						}
					: { user: null, session: null }
			)
		}
	} as any;
}

function mockQueries({
	dailyMovie = {
		movie: {
			id: 42,
			title: 'Inception',
			hints: defaultHints
		}
	} as unknown,
	sessionResult = {
		data: {
			id: 'game-1',
			user_id: 'user-1',
			target_movie_id: 42,
			status: 'in_progress',
			max_attempts: 10,
			created_at: '2026-10-12T00:00:00Z',
			updated_at: '2026-10-12T00:00:00Z',
			guesses: createGuesses(6),
			taken_hints: []
		},
		error: null
	} as { data: unknown; error: unknown },
	insertResult = { error: null } as { error: unknown },
	reloadedSessionResult = undefined as { data: unknown; error: unknown } | undefined
} = {}) {
	const dailySingle = vi.fn().mockResolvedValue({ data: dailyMovie, error: null });
	const dailyEq = vi.fn().mockReturnValue({ single: dailySingle });
	const dailySelect = vi.fn().mockReturnValue({ eq: dailyEq });

	let sessionCallCount = 0;
	let insertedHint: Record<string, unknown> | null = null;

	const sessionMaybeSingle = vi.fn().mockImplementation(async () => {
		sessionCallCount += 1;
		if (sessionCallCount > 1) {
			if (reloadedSessionResult !== undefined) {
				return reloadedSessionResult;
			}
			if (insertedHint && sessionResult.data) {
				const session = sessionResult.data as Record<string, unknown> & {
					taken_hints?: unknown[];
				};
				return {
					...sessionResult,
					data: {
						...session,
						taken_hints: [...(session.taken_hints ?? []), insertedHint]
					}
				};
			}
		}
		return sessionResult;
	});
	const sessionEqMovie = vi.fn().mockReturnValue({ maybeSingle: sessionMaybeSingle });
	const sessionEqUser = vi.fn().mockReturnValue({ eq: sessionEqMovie });
	const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEqUser });

	const hintInsert = vi.fn().mockImplementation(async (row: Record<string, unknown>) => {
		if (!insertResult.error) {
			insertedHint = { id: 'hint-new', ...row };
		}
		return insertResult;
	});

	vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
		if (table === 'daily_movies') {
			return { select: dailySelect } as any;
		}
		if (table === 'game_sessions') {
			return { select: sessionSelect } as any;
		}
		if (table === 'game_session_hints') {
			return { insert: hintInsert } as any;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	return { dailyEq, sessionEqUser, sessionEqMovie, hintInsert };
}

describe('POST /movies/hint', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects malformed date with 400', async () => {
		await expect(
			POST(createEvent({ date: 'not-a-date', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('rejects future date with 400', async () => {
		await expect(
			POST(createEvent({ date: '2026-10-13', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('rejects invalid hint type with 400', async () => {
		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'invalid_hint' }))
		).rejects.toMatchObject({ status: 400 });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('returns 404 when no daily movie exists for date', async () => {
		mockQueries({ dailyMovie: null });

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 when daily movie has no hints', async () => {
		mockQueries({
			dailyMovie: { movie: { id: 42, title: 'Inception', hints: null } }
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns 401 when user is not authenticated', async () => {
		mockQueries();

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }, null))
		).rejects.toMatchObject({ status: 401 });
	});

	it('returns 400 when game session does not exist', async () => {
		mockQueries({
			sessionResult: { data: null, error: null }
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when game is already finished', async () => {
		mockQueries({
			sessionResult: {
				data: {
					id: 'game-1',
					user_id: 'user-1',
					target_movie_id: 42,
					status: 'won',
					max_attempts: 10,
					created_at: '2026-10-12T00:00:00Z',
					updated_at: '2026-10-12T00:00:00Z',
					guesses: createGuesses(6),
					taken_hints: []
				},
				error: null
			}
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when no hints are unlocked yet', async () => {
		mockQueries({
			sessionResult: {
				data: {
					id: 'game-1',
					user_id: 'user-1',
					target_movie_id: 42,
					status: 'in_progress',
					max_attempts: 10,
					created_at: '2026-10-12T00:00:00Z',
					updated_at: '2026-10-12T00:00:00Z',
					guesses: createGuesses(4),
					taken_hints: []
				},
				error: null
			}
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when requested hint was already used', async () => {
		mockQueries({
			sessionResult: {
				data: {
					id: 'game-1',
					user_id: 'user-1',
					target_movie_id: 42,
					status: 'in_progress',
					max_attempts: 10,
					created_at: '2026-10-12T00:00:00Z',
					updated_at: '2026-10-12T00:00:00Z',
					guesses: createGuesses(9),
					taken_hints: [
						{
							id: 'hint-1',
							game_id: 'game-1',
							hint_type: 'tagline',
							unlocked_at_guess: 6,
							created_at: '2026-10-12T12:00:00Z'
						}
					]
				},
				error: null
			}
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 404 when the requested hint has no value for the movie', async () => {
		mockQueries({
			dailyMovie: {
				movie: {
					id: 42,
					title: 'Inception',
					hints: { ...defaultHints, tagline: '   ' }
				}
			}
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns 500 when inserting game_session_hints fails', async () => {
		mockQueries({
			insertResult: { error: { message: 'Insert failed' } }
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 500 });
	});

	it('returns 400 when reloaded game session is not found after inserting hint', async () => {
		mockQueries({
			reloadedSessionResult: { data: null, error: null }
		});

		await expect(
			POST(createEvent({ date: '2026-10-12', hint: 'tagline' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('inserts hint and returns updated session with tagline on success', async () => {
		const { dailyEq, hintInsert } = mockQueries();

		const response = await POST(createEvent({ hint: 'tagline' }, 'user-1'));
		expect(response.status).toBe(200);
		expect(dailyEq).toHaveBeenCalledWith('play_date', '2026-10-12');
		expect(hintInsert).toHaveBeenCalledWith({
			game_id: 'game-1',
			hint_type: 'tagline',
			unlocked_at_guess: 6,
			created_at: '2026-10-12T12:00:00.000Z'
		});
		expect(await response.json()).toEqual({
			guesses: [],
			gameStatus: 'in_progress',
			targetMovie: null,
			availableHints: {
				unusedHintsCount: 0,
				hints: []
			},
			usedHints: [
				{
					hintType: 'tagline',
					value: 'Your mind is the scene of the crime.'
				}
			]
		});
	});

	it('returns updated session with remaining available hints when 2 hints are unlocked', async () => {
		mockQueries({
			sessionResult: {
				data: {
					id: 'game-1',
					user_id: 'user-1',
					target_movie_id: 42,
					status: 'in_progress',
					max_attempts: 10,
					created_at: '2026-10-12T00:00:00Z',
					updated_at: '2026-10-12T00:00:00Z',
					guesses: createGuesses(9),
					taken_hints: []
				},
				error: null
			}
		});

		const response = await POST(createEvent({ date: '2026-10-12', hint: 'tagline' }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			guesses: [],
			gameStatus: 'in_progress',
			targetMovie: null,
			availableHints: {
				unusedHintsCount: 1,
				hints: ['keywords', 'poster']
			},
			usedHints: [
				{
					hintType: 'tagline',
					value: 'Your mind is the scene of the crime.'
				}
			]
		});
	});

	it('returns updated session with keywords hint on success', async () => {
		mockQueries();

		const response = await POST(createEvent({ date: '2026-10-12', hint: 'keywords' }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			guesses: [],
			gameStatus: 'in_progress',
			targetMovie: null,
			availableHints: {
				unusedHintsCount: 0,
				hints: []
			},
			usedHints: [
				{
					hintType: 'keywords',
					value: ['dream', 'subconscious', 'heist']
				}
			]
		});
	});

	it('returns updated session with formatted poster URL on success', async () => {
		mockQueries();

		const response = await POST(createEvent({ date: '2026-10-12', hint: 'poster' }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			guesses: [],
			gameStatus: 'in_progress',
			targetMovie: null,
			availableHints: {
				unusedHintsCount: 0,
				hints: []
			},
			usedHints: [
				{
					hintType: 'poster',
					value: buildPosterHintUrl('inception-key')
				}
			]
		});
	});
});
