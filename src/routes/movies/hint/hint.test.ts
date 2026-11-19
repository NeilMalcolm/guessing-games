import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({
	supabaseAdmin: {
		from: vi.fn()
	}
}));

vi.mock('@sentry/sveltekit', () => ({
	logger: {
		error: vi.fn()
	}
}));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { logger } from '@sentry/sveltekit';
import { GET } from './+server';

const NOW = new Date('2026-10-12T12:00:00Z');

function createEvent(urlStr: string, userId: string | null = 'user-1') {
	return {
		url: new URL(urlStr, 'http://example.com'),
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
	dailyMovie = { movie: { id: 42, title: 'Inception' } } as unknown,
	sessionResult = { data: null, error: null } as { data: unknown; error: unknown }
} = {}) {
	const dailySingle = vi.fn().mockResolvedValue({ data: dailyMovie, error: null });
	const dailyEq = vi.fn().mockReturnValue({ single: dailySingle });
	const dailySelect = vi.fn().mockReturnValue({ eq: dailyEq });

	const sessionMaybeSingle = vi.fn().mockResolvedValue(sessionResult);
	const sessionEqMovie = vi.fn().mockReturnValue({ maybeSingle: sessionMaybeSingle });
	const sessionEqUser = vi.fn().mockReturnValue({ eq: sessionEqMovie });
	const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEqUser });

	vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
		if (table === 'daily_movies') {
			return { select: dailySelect } as any;
		}
		if (table === 'game_sessions') {
			return { select: sessionSelect } as any;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	return { dailyEq, sessionEqUser, sessionEqMovie };
}

describe('GET /movies/hint', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
		vi.mocked(logger.error).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects malformed date with 400', async () => {
		await expect(GET(createEvent('/movies/hint?date=not-a-date'))).rejects.toMatchObject({
			status: 400
		});
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('rejects future date with 400', async () => {
		await expect(GET(createEvent('/movies/hint?date=2026-10-13'))).rejects.toMatchObject({
			status: 400
		});
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('returns 404 when no daily movie exists for date', async () => {
		mockQueries({ dailyMovie: null });

		await expect(GET(createEvent('/movies/hint?date=2026-10-12'))).rejects.toMatchObject({
			status: 404
		});
	});

	it('returns 400 when user is not authenticated', async () => {
		mockQueries();

		const response = await GET(createEvent('/movies/hint?date=2026-10-12', null));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ availableHints: [] });
		expect(logger.error).toHaveBeenCalled();
	});

	it('returns 500 when game_sessions query fails', async () => {
		mockQueries({
			sessionResult: {
				data: null,
				error: { message: 'Database error' }
			}
		});

		const response = await GET(createEvent('/movies/hint?date=2026-10-12'));
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ availableHints: [] });
		expect(logger.error).toHaveBeenCalled();
	});

	it('defaults to today when date is omitted and returns all hints unused when no session exists yet', async () => {
		const { dailyEq, sessionEqUser, sessionEqMovie } = mockQueries({
			sessionResult: { data: null, error: null }
		});

		const response = await GET(createEvent('/movies/hint', 'user-1'));
		expect(response.status).toBe(200);
		expect(dailyEq).toHaveBeenCalledWith('play_date', '2026-10-12');
		expect(sessionEqUser).toHaveBeenCalledWith('user_id', 'user-1');
		expect(sessionEqMovie).toHaveBeenCalledWith('target_movie_id', 42);
		expect(await response.json()).toEqual({
			availableHints: [
				{ hintType: 'tagline', used: false },
				{ hintType: 'keywords', used: false },
				{ hintType: 'poster', used: false }
			]
		});
	});

	it('marks used hint types as used based on session_hints', async () => {
		mockQueries({
			sessionResult: {
				data: {
					id: 'game-1',
					user_id: 'user-1',
					target_movie_id: 42,
					session_hints: [
						{
							id: 'hint-1',
							game_id: 'game-1',
							hint_type: 'tagline',
							unlocked_at_guess: 6,
							created_at: '2026-10-12T12:00:00Z'
						},
						{
							id: 'hint-2',
							game_id: 'game-1',
							hint_type: 'poster',
							unlocked_at_guess: 9,
							created_at: '2026-10-12T12:05:00Z'
						}
					]
				},
				error: null
			}
		});

		const response = await GET(createEvent('/movies/hint?date=2026-10-12', 'user-1'));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			availableHints: [
				{ hintType: 'tagline', used: true },
				{ hintType: 'keywords', used: false },
				{ hintType: 'poster', used: true }
			]
		});
	});
});
