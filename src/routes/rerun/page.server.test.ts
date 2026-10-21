import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$env/static/public', () => ({ PUBLIC_TMDB_THUMB_URL: 'https://example.com' }));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { load } from './+page.server';

const NOW = new Date('2026-10-12T12:00:00Z');

/** Makes the (awaitable) rerun query resolve to the given result. */
function mockQuery(result: { data?: unknown; error?: { message: string } | null }) {
	const query: any = {
		select: vi.fn(() => query),
		lt: vi.fn(() => query),
		order: vi.fn(() => query),
		eq: vi.fn(() => query),
		then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null, ...result })
	};
	vi.mocked(supabaseAdmin.from).mockReturnValue(query);
	return query;
}

function runLoad(user: unknown = { id: 'user-1' }) {
	const event: any = { locals: { safeGetSession: async () => ({ user }) } };
	return load(event) as Promise<any>;
}

const day = (play_date: string, status?: string, poster_path: string | null = '/p.jpg') => ({
	play_date,
	movie: { poster_path, game_sessions: status ? [{ status }] : [] }
});

describe('rerun +page.server load', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('only queries days before today, newest first', async () => {
		const query = mockQuery({ data: [] });
		await runLoad();
		expect(query.lt).toHaveBeenCalledWith('play_date', '2026-10-12');
		expect(query.order).toHaveBeenCalledWith('play_date', { ascending: false });
	});

	it("filters sessions to the current user's id", async () => {
		const query = mockQuery({ data: [] });
		await runLoad({ id: 'user-1' });
		expect(query.eq).toHaveBeenCalledWith('movie.game_sessions.user_id', 'user-1');
	});

	it('uses an empty user id when logged out', async () => {
		const query = mockQuery({ data: [] });
		await runLoad(null);
		expect(query.eq).toHaveBeenCalledWith('movie.game_sessions.user_id', '');
	});

	it('throws a 500 when the query fails', async () => {
		mockQuery({ error: { message: 'boom' } });
		await expect(runLoad()).rejects.toMatchObject({ status: 500 });
	});

	it('returns an empty list when there are no days', async () => {
		mockQuery({ data: [] });
		expect(await runLoad()).toEqual({ rerunDays: [] });
	});

	it('reveals the poster for won and lost games', async () => {
		mockQuery({ data: [day('2026-10-11', 'won'), day('2026-10-10', 'lost')] });
		const { rerunDays } = await runLoad();
		expect(rerunDays).toEqual([
			{ playDate: '2026-10-11', status: 'won', poster: 'https://example.com/p.jpg' },
			{ playDate: '2026-10-10', status: 'lost', poster: 'https://example.com/p.jpg' }
		]);
	});

	it('hides the poster for in-progress games', async () => {
		mockQuery({ data: [day('2026-10-11', 'in_progress')] });
		const { rerunDays } = await runLoad();
		expect(rerunDays[0]).toEqual({ playDate: '2026-10-11', status: 'in_progress', poster: null });
	});

	it('has null status and no poster for unplayed days', async () => {
		mockQuery({ data: [day('2026-10-11')] });
		const { rerunDays } = await runLoad();
		expect(rerunDays[0]).toEqual({ playDate: '2026-10-11', status: null, poster: null });
	});

	it('handles a missing movie', async () => {
		mockQuery({ data: [{ play_date: '2026-10-11', movie: null }] });
		const { rerunDays } = await runLoad();
		expect(rerunDays[0]).toEqual({ playDate: '2026-10-11', status: null, poster: null });
	});

	it('has no poster when a finished game has no poster_path', async () => {
		mockQuery({ data: [day('2026-10-11', 'won', null)] });
		const { rerunDays } = await runLoad();
		expect(rerunDays[0].poster).toBeNull();
		expect(rerunDays[0].status).toBe('won');
	});
});

