import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_TMDB_THUMB_URL: 'https://image.tmdb.org/t/p/w92'
}));

vi.mock('$lib/supabaseAdmin', () => ({
	supabaseAdmin: {
		rpc: vi.fn()
	}
}));

import { supabaseAdmin } from '$lib/supabaseAdmin';
import { GET } from './+server';
import type { SearchResponse } from '$lib/types/search';

function createEvent(urlStr: string) {
	return {
		url: new URL(urlStr, 'http://localhost')
	} as any;
}

describe('GET /movies/search', () => {
	beforeEach(() => {
		vi.mocked(supabaseAdmin.rpc).mockReset();
	});

	it('returns { results: [] } when title query param is missing', async () => {
		const response = await GET(createEvent('/movies/search'));
		expect(response.status).toBe(200);

		const data: SearchResponse = await response.json();
		expect(data).toEqual({ results: [] });
		expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
	});

	it('returns { results: [] } when title query param is empty string', async () => {
		const response = await GET(createEvent('/movies/search?title='));
		expect(response.status).toBe(200);

		const data: SearchResponse = await response.json();
		expect(data).toEqual({ results: [] });
		expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
	});

	it('returns { results: [] } with status 500 when database error occurs', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
			data: null,
			error: { message: 'Database connection failed' }
		} as any);

		const response = await GET(createEvent('/movies/search?title=Inception'));
		expect(response.status).toBe(500);

		const data: SearchResponse = await response.json();
		expect(data).toEqual({ results: [] });
		expect(supabaseAdmin.rpc).toHaveBeenCalledWith('movie_search', { search_term: 'Inception' });
		expect(consoleErrorSpy).toHaveBeenCalled();
		consoleErrorSpy.mockRestore();
	});

	it('returns formatted results when search finds movies', async () => {
		vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
			data: [
				{
					id: 1,
					title: 'Inception',
					release_year: 2010,
					poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg'
				},
				{
					id: 2,
					title: 'Interstellar',
					release_year: 2014,
					poster_path: null
				}
			],
			error: null
		} as any);

		const response = await GET(createEvent('/movies/search?title=Incep'));
		expect(response.status).toBe(200);

		const data: SearchResponse = await response.json();
		expect(data).toEqual({
			results: [
				{
					id: 1,
					title: 'Inception',
					imagePath: 'https://image.tmdb.org/t/p/w92/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg'
				},
				{
					id: 2,
					title: 'Interstellar',
					imagePath: ''
				}
			]
		});
	});

	it('appends release year to titles with duplicates (case-insensitive)', async () => {
		vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
			data: [
				{
					id: 10,
					title: 'Halloween',
					release_year: 1978,
					poster_path: '/halloween1978.jpg'
				},
				{
					id: 20,
					title: 'halloween',
					release_year: 2018,
					poster_path: '/halloween2018.jpg'
				},
				{
					id: 30,
					title: 'Halloween II',
					release_year: 1981,
					poster_path: null
				}
			],
			error: null
		} as any);

		const response = await GET(createEvent('/movies/search?title=halloween'));
		expect(response.status).toBe(200);

		const data: SearchResponse = await response.json();
		expect(data.results).toEqual([
			{
				id: 10,
				title: 'Halloween (1978)',
				imagePath: 'https://image.tmdb.org/t/p/w92/halloween1978.jpg'
			},
			{
				id: 20,
				title: 'halloween (2018)',
				imagePath: 'https://image.tmdb.org/t/p/w92/halloween2018.jpg'
			},
			{
				id: 30,
				title: 'Halloween II',
				imagePath: ''
			}
		]);
	});
});

