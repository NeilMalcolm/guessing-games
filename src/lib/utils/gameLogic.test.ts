import { describe, it, expect } from 'vitest';
import { mapGameSessionToClientResponse } from './gameLogic';
import type { GameSessionResponse, Movie } from '$lib/types/supabasetables';

const mockMovie: Movie = {
	id: 1,
	title: 'Fight Club',
	release_year: 1999,
	poster_path: '/poster.jpg',
	genres: ['Drama', 'Thriller'],
	director: 'David Fincher',
	director_profile_path: '/fincher.jpg',
	popularity: 80,
	cast_members: [
		{ id: 10, name: 'Brad Pitt', character: 'Tyler Durden', order: 0, profile_path: '/brad.jpg' }
	],
	box_office: 100_000_000,
	rating: 8.8,
	min_age: 18,
	certifications: { US: 'R', GB: '18' },
	video: 'SUXWAEX2jlg',
	cached_at: '2026-01-01T00:00:00Z'
};

function createSession(status: 'in_progress' | 'won' | 'lost'): GameSessionResponse {
	return {
		id: 'session-123',
		user_id: 'user-456',
		target_movie_id: 1,
		status,
		max_attempts: 6,
		created_at: '2026-10-12T00:00:00Z',
		updated_at: '2026-10-12T00:00:00Z',
		guesses: []
	};
}

describe('mapGameSessionToClientResponse targetMovie video URL exposure', () => {
	it('does not return targetMovie or video URL when status is in_progress', () => {
		const session = createSession('in_progress');
		const result = mapGameSessionToClientResponse(session, mockMovie);

		expect(result.gameStatus).toBe('in_progress');
		expect(result.targetMovie).toBeNull();
	});

	it('returns targetMovie with title and embed video URL when status is won', () => {
		const session = createSession('won');
		const result = mapGameSessionToClientResponse(session, mockMovie);

		expect(result.gameStatus).toBe('won');
		expect(result.targetMovie).toEqual({
			title: 'Fight Club',
			videoUrl: 'https://www.youtube.com/embed/SUXWAEX2jlg'
		});
	});

	it('returns targetMovie with title and embed video URL when status is lost', () => {
		const session = createSession('lost');
		const result = mapGameSessionToClientResponse(session, mockMovie);

		expect(result.gameStatus).toBe('lost');
		expect(result.targetMovie).toEqual({
			title: 'Fight Club',
			videoUrl: 'https://www.youtube.com/embed/SUXWAEX2jlg'
		});
	});

	it('omits or handles targetMovie when video is null or empty upon win/loss', () => {
		const movieWithoutVideo: Movie = {
			...mockMovie,
			video: null
		};
		const session = createSession('won');
		const result = mapGameSessionToClientResponse(session, movieWithoutVideo);

		expect(result.targetMovie).toEqual({
			title: 'Fight Club',
			videoUrl: 'https://www.youtube.com/embed/null'
		});
	});
});

