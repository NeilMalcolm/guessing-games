import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$lib/utils/gameLogic', () => ({
	mapGameSessionToClientResponse: vi.fn((session) => ({
		guesses: [],
		gameStatus: session.status,
		targetMovie: session.status === 'in_progress' ? null : { title: 'Target', videoUrl: '' }
	}))
}));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { mapGameSessionToClientResponse } from '$lib/utils/gameLogic';
import { load } from './+page.server';

const NOW = new Date('2026-10-12T12:00:00Z');

/** Makes the daily movies query resolve to the given data. */
function mockDailyMovie(data: unknown) {
	const query: any = {
		select: vi.fn(() => query),
		eq: vi.fn(() => query),
		single: vi.fn(async () => ({ data }))
	};
	vi.mocked(supabaseAdmin.from).mockReturnValue(query);
	return query;
}

function runLoad(date: string | undefined, user: unknown = { id: 'user-1' }) {
	const event: any = {
		params: date === undefined ? {} : { date },
		locals: { safeGetSession: async () => ({ user }) }
	};
	return load(event) as Promise<any>;
}

describe('+page.server load date handling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
		vi.mocked(mapGameSessionToClientResponse).mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to today when no date is given', async () => {
		const result = await runLoad(undefined, null);
		expect(result.playDate).toBe('2026-10-12');
	});

	it('uses the date from the URL', async () => {
		const result = await runLoad('2026-10-11', null);
		expect(result.playDate).toBe('2026-10-11');
	});

	it('allows today explicitly', async () => {
		const result = await runLoad('2026-10-12', null);
		expect(result.playDate).toBe('2026-10-12');
	});

	it('returns 404 for future dates', async () => {
		await expect(runLoad('2026-10-13')).rejects.toMatchObject({ status: 404 });
	});

	it('queries the daily movie for the requested date', async () => {
		const query = mockDailyMovie(null);
		const result = await runLoad('2026-10-10');
		expect(query.eq).toHaveBeenCalledWith('play_date', '2026-10-10');
		expect(result).toEqual({ guesses: [], gameStatus: 'in_progress', playDate: '2026-10-10' });
	});

	it('queries today when no date is given', async () => {
		const query = mockDailyMovie(null);
		const result = await runLoad(undefined);
		expect(query.eq).toHaveBeenCalledWith('play_date', '2026-10-12');
		expect(result).toEqual({ guesses: [], gameStatus: 'in_progress', playDate: '2026-10-12' });
	});

	it('returns mapped session data when user has an existing session', async () => {
		const dailyMovie = { id: 42, title: 'Inception' };
		const session = {
			id: 'session-1',
			user_id: 'user-1',
			target_movie_id: 42,
			status: 'in_progress',
			guesses: [{ movie_id: 10 }]
		};

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: dailyMovie } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								maybeSingle: async () => ({ data: session, error: null })
							})
						})
					})
				} as any;
			}
			return {} as any;
		});

		const result = await runLoad('2026-10-12', { id: 'user-1' });
		expect(result.gameStatus).toBe('in_progress');
		expect(result.playDate).toBe('2026-10-12');
		expect(mapGameSessionToClientResponse).toHaveBeenCalledWith(session, dailyMovie);
	});

	it('returns gave_up session status when user gave up', async () => {
		const dailyMovie = { id: 42, title: 'Inception' };
		const session = {
			id: 'session-1',
			user_id: 'user-1',
			target_movie_id: 42,
			status: 'gave_up',
			guesses: []
		};

		vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
			if (table === 'daily_movies') {
				return {
					select: () => ({
						eq: () => ({
							single: async () => ({ data: { movie: dailyMovie } })
						})
					})
				} as any;
			}
			if (table === 'game_sessions') {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								maybeSingle: async () => ({ data: session, error: null })
							})
						})
					})
				} as any;
			}
			return {} as any;
		});

		const result = await runLoad('2026-10-12', { id: 'user-1' });
		expect(result.gameStatus).toBe('gave_up');
		expect(result.playDate).toBe('2026-10-12');
	});
});
