import { describe, it, expect, vi, beforeEach } from 'vitest';

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

function createEvent(urlStr: string, userId: string | null = 'user-1') {
	return {
		url: new URL(urlStr, 'http://localhost'),
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

function mockGameSessionQuery(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const eqUser = vi.fn().mockReturnValue({ single });
	const eqId = vi.fn().mockReturnValue({ eq: eqUser });
	const select = vi.fn().mockReturnValue({ eq: eqId });
	vi.mocked(supabaseAdmin.from).mockReturnValue({ select } as any);

	return { select, eqId, eqUser, single };
}

describe('GET /movies/hint', () => {
	beforeEach(() => {
		vi.mocked(supabaseAdmin.from).mockReset();
		vi.mocked(logger.error).mockReset();
	});

	it('returns 400 when gid query param is missing', async () => {
		const response = await GET(createEvent('/movies/hint'));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ results: [] });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalled();
	});

	it('returns 400 when gid query param is empty', async () => {
		const response = await GET(createEvent('/movies/hint?gid='));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ results: [] });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
	});

	it('returns 400 when user is not authenticated', async () => {
		const response = await GET(createEvent('/movies/hint?gid=game-1', null));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ results: [] });
		expect(supabaseAdmin.from).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalled();
	});

	it('returns 500 when database query fails', async () => {
		mockGameSessionQuery({
			data: null,
			error: { message: 'Database error' }
		});

		const response = await GET(createEvent('/movies/hint?gid=game-1'));
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ results: [] });
		expect(logger.error).toHaveBeenCalled();
	});

	it('returns all hint types as unused when no session hints exist', async () => {
		const { eqId, eqUser } = mockGameSessionQuery({
			data: {
				id: 'game-1',
				user_id: 'user-1',
				session_hints: []
			},
			error: null
		});

		const response = await GET(createEvent('/movies/hint?gid=game-1', 'user-1'));
		expect(response.status).toBe(200);
		expect(supabaseAdmin.from).toHaveBeenCalledWith('game_sessions');
		expect(eqId).toHaveBeenCalledWith('id', 'game-1');
		expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
		expect(await response.json()).toEqual({
			availableHints: [
				{ hintType: 'tagline', used: false },
				{ hintType: 'keywords', used: false },
				{ hintType: 'poster', used: false }
			]
		});
	});

	it('marks used hint types as used based on session_hints', async () => {
		mockGameSessionQuery({
			data: {
				id: 'game-1',
				user_id: 'user-1',
				session_hints: [
					{
						id: 'hint-1',
						game_id: 'game-1',
						hint_type: 'tagline',
						unlocked_at_guess: 6,
						created_at: '2026-11-19T20:00:00Z'
					},
					{
						id: 'hint-2',
						game_id: 'game-1',
						hint_type: 'poster',
						unlocked_at_guess: 9,
						created_at: '2026-11-19T20:05:00Z'
					}
				]
			},
			error: null
		});

		const response = await GET(createEvent('/movies/hint?gid=game-1', 'user-1'));
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
