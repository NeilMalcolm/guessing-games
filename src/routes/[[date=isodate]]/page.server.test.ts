import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('$lib/utils/gameLogic', () => ({ mapGameSessionToClientResponse: vi.fn() }));

import { supabaseAdmin } from '$lib/supabaseAdmin';
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
		await runLoad(undefined);
		expect(query.eq).toHaveBeenCalledWith('play_date', '2026-10-12');
	});
});

