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
});


