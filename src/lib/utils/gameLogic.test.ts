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
			videoUrl: null
		});
	});
	it('sets videoUrl to null when video is an empty string upon win/loss', () => {
		const movieWithEmptyVideo: Movie = {
			...mockMovie,
			video: ''
		};
		const session = createSession('won');
		const result = mapGameSessionToClientResponse(session, movieWithEmptyVideo);

		expect(result.targetMovie).toEqual({
			title: 'Fight Club',
			videoUrl: null
		});
	});
});

describe('mapGameSessionToClientResponse hints mapping', () => {
	const movieWithHints: Movie = {
		...mockMovie,
		hints: {
			movie_id: 1,
			tagline: 'Mischief. Mayhem. Soap.',
			keywords: ['dual identity', 'support group', 'nihilism'],
			poster_key: 'posters/1.webp',
			created_at: '2026-01-01T00:00:00Z',
			hints_fetched_at: '2026-01-01T00:00:00Z'
		}
	};

	it('returns empty availableHints and usedHints when movie has no hints', () => {
		const session = createSession('in_progress');
		const result = mapGameSessionToClientResponse(session, mockMovie);

		expect(result.availableHints).toEqual([]);
		expect(result.usedHints).toEqual([]);
	});

	it('returns all non-empty hint types in availableHints when none are taken', () => {
		const moviePartialHints: Movie = {
			...mockMovie,
			hints: {
				movie_id: 1,
				tagline: '   ',
				keywords: ['dual identity'],
				poster_key: 'posters/1.webp',
				created_at: '2026-01-01T00:00:00Z',
				hints_fetched_at: '2026-01-01T00:00:00Z'
			}
		};
		const session = createSession('in_progress');
		const result = mapGameSessionToClientResponse(session, moviePartialHints);

		expect(result.availableHints).toEqual(['keywords', 'poster']);
		expect(result.usedHints).toEqual([]);
	});

	it('populates usedHints with values and excludes them from availableHints', () => {
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			taken_hints: [
				{
					id: 'hint-1',
					game_id: 'session-123',
					hint_type: 'tagline',
					unlocked_at_guess: 6,
					created_at: '2026-10-12T00:01:00Z'
				},
				{
					id: 'hint-2',
					game_id: 'session-123',
					hint_type: 'poster',
					unlocked_at_guess: 9,
					created_at: '2026-10-12T00:02:00Z'
				}
			]
		};

		const result = mapGameSessionToClientResponse(session, movieWithHints);

		expect(result.usedHints).toEqual([
			{ hintType: 'tagline', value: 'Mischief. Mayhem. Soap.' },
			{ hintType: 'poster', value: 'posters/1.webp' }
		]);
		expect(result.availableHints).toEqual(['keywords']);
	});
});
