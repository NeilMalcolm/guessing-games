import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import {
	parseAndValidatePlayDate,
	getDailyMovie,
	getRequiredDailyMovie,
	getOrCreateUser,
	getGameSession,
	createGameSession,
	getOrCreateGameSession,
	updateGameSessionStatus,
	reloadGameSession
} from './gameSession';

const NOW = new Date('2026-10-12T12:00:00Z');

describe('gameSession utilities', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(supabaseAdmin.from).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('parseAndValidatePlayDate', () => {
		it('defaults to today when date is undefined or null', () => {
			expect(parseAndValidatePlayDate(undefined)).toBe('2026-10-12');
			expect(parseAndValidatePlayDate(null)).toBe('2026-10-12');
		});

		it('accepts valid past or present date', () => {
			expect(parseAndValidatePlayDate('2026-10-11')).toBe('2026-10-11');
			expect(parseAndValidatePlayDate('2026-10-12')).toBe('2026-10-12');
		});

		it('throws 400 for malformed date', () => {
			expect(() => parseAndValidatePlayDate('invalid')).toThrow();
			expect(() => parseAndValidatePlayDate('2026-1-1')).toThrow();
		});

		it('throws 400 for future date', () => {
			expect(() => parseAndValidatePlayDate('2026-10-13')).toThrow();
		});
	});

	describe('getDailyMovie / getRequiredDailyMovie', () => {
		it('returns movie when found', async () => {
			vi.mocked(supabaseAdmin.from).mockReturnValue({
				select: () => ({
					eq: () => ({
						single: async () => ({ data: { movie: { id: 10, title: 'Alien' } } })
					})
				})
			} as any);

			const movie = await getRequiredDailyMovie('2026-10-12');
			expect(movie).toEqual({ id: 10, title: 'Alien' });
		});

		it('throws 404 when movie is not found', async () => {
			vi.mocked(supabaseAdmin.from).mockReturnValue({
				select: () => ({
					eq: () => ({
						single: async () => ({ data: null })
					})
				})
			} as any);

			await expect(getRequiredDailyMovie('2026-10-12')).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('getOrCreateUser', () => {
		it('returns user from active session', async () => {
			const locals: any = {
				safeGetSession: vi.fn().mockResolvedValue({
					user: { id: 'user-active' },
					session: { user: { id: 'user-active' } }
				})
			};

			const user = await getOrCreateUser(locals);
			expect(user.id).toBe('user-active');
		});

		it('signs in anonymously when no active session', async () => {
			const locals: any = {
				safeGetSession: vi.fn().mockResolvedValue({ session: null, user: null }),
				supabase: {
					auth: {
						signInAnonymously: vi.fn().mockResolvedValue({
							data: {
								user: { id: 'anon-user' },
								session: { user: { id: 'anon-user' } }
							}
						})
					}
				}
			};

			const user = await getOrCreateUser(locals);
			expect(user.id).toBe('anon-user');
			expect(locals.supabase.auth.signInAnonymously).toHaveBeenCalled();
		});

		it('throws 401 when anonymous sign-in yields no user', async () => {
			const locals: any = {
				safeGetSession: vi.fn().mockResolvedValue({ session: null, user: null }),
				supabase: {
					auth: {
						signInAnonymously: vi.fn().mockResolvedValue({
							data: { user: null, session: null }
						})
					}
				}
			};

			await expect(getOrCreateUser(locals)).rejects.toMatchObject({ status: 401 });
		});
	});

	describe('getOrCreateGameSession', () => {
		it('returns existing session if found', async () => {
			const existingSession = { id: 'session-1', user_id: 'u-1', target_movie_id: 10, status: 'in_progress', guesses: [] };
			vi.mocked(supabaseAdmin.from).mockReturnValue({
				select: () => ({
					eq: () => ({
						eq: () => ({
							maybeSingle: async () => ({ data: existingSession, error: null })
						})
					})
				})
			} as any);

			const session = await getOrCreateGameSession('u-1', 10);
			expect(session.id).toBe('session-1');
		});

		it('creates new session if not found', async () => {
			const newSessionRow = { id: 'session-new', user_id: 'u-1', target_movie_id: 10, status: 'in_progress' };
			vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
				return {
					select: () => ({
						eq: () => ({
							eq: () => ({
								maybeSingle: async () => ({ data: null, error: null })
							})
						})
					}),
					insert: () => ({
						select: () => ({
							single: async () => ({ data: newSessionRow, error: null })
						})
					})
				} as any;
			});

			const session = await getOrCreateGameSession('u-1', 10);
			expect(session.id).toBe('session-new');
			expect(session.guesses).toEqual([]);
		});
	});

	describe('updateGameSessionStatus and reloadGameSession', () => {
		it('updates status and updated_at', async () => {
			const updateMock = vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ error: null })
				})
			});
			vi.mocked(supabaseAdmin.from).mockReturnValue({ update: updateMock } as any);

			await updateGameSessionStatus('s-1', 'u-1', 'gave_up');
			expect(updateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'gave_up',
					updated_at: expect.any(String)
				})
			);
		});

		it('reloads session with joined data', async () => {
			const reloaded = { id: 's-1', user_id: 'u-1', target_movie_id: 10, status: 'won', guesses: [] };
			vi.mocked(supabaseAdmin.from).mockReturnValue({
				select: () => ({
					eq: () => ({
						eq: () => ({
							single: async () => ({ data: reloaded, error: null })
						})
					})
				})
			} as any);

			const session = await reloadGameSession('s-1', 'u-1');
			expect(session).toEqual(reloaded);
		});
	});
});

