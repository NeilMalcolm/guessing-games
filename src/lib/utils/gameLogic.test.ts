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

	function createWrongGuesses(count: number): GameSessionResponse['guesses'] {
		return Array.from({ length: count }, (_, idx) => ({
			id: `guess-${idx + 1}`,
			guess_number: idx + 1,
			movie_id: 100 + idx,
			is_correct: false,
			created_at: '2026-10-12T00:00:00Z',
			movie: { ...mockMovie, id: 100 + idx, title: `Wrong Movie ${idx + 1}` }
		}));
	}

	it('returns empty availableHints and usedHints when movie has no hints', () => {
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(6)
		};
		const result = mapGameSessionToClientResponse(session, mockMovie);

		expect(result.availableHints).toEqual([]);
		expect(result.usedHints).toEqual([]);
	});

	it('returns empty availableHints before 6 unsuccessful guesses', () => {
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(5)
		};
		const result = mapGameSessionToClientResponse(session, movieWithHints);

		expect(result.availableHints).toEqual([]);
		expect(result.usedHints).toEqual([]);
	});

	it('returns non-empty hint types after 6 unsuccessful guesses when none are taken', () => {
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
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(6)
		};
		const result = mapGameSessionToClientResponse(session, moviePartialHints);

		expect(result.availableHints).toEqual(['keywords', 'poster']);
		expect(result.usedHints).toEqual([]);
	});

	it('keeps first hint available on turns 7 and 8 if not taken after turn 6', () => {
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(7)
		};
		const result = mapGameSessionToClientResponse(session, movieWithHints);

		expect(result.availableHints).toEqual(['tagline', 'keywords', 'poster']);
	});

	it('returns empty availableHints on turns 6-8 once 1 hint has been taken', () => {
		const session: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(8),
			taken_hints: [
				{
					id: 'hint-1',
					game_id: 'session-123',
					hint_type: 'tagline',
					unlocked_at_guess: 6,
					created_at: '2026-10-12T00:01:00Z'
				}
			]
		};
		const result = mapGameSessionToClientResponse(session, movieWithHints);

		expect(result.usedHints).toEqual([{ hintType: 'tagline', value: 'Mischief. Mayhem. Soap.' }]);
		expect(result.availableHints).toEqual([]);
	});

	it('allows taking 2 hints after 9 unsuccessful guesses if none were taken yet', () => {
		const sessionWithZeroTaken: GameSessionResponse = {
			...createSession('in_progress'),
			guesses: createWrongGuesses(9),
			taken_hints: []
		};
		expect(mapGameSessionToClientResponse(sessionWithZeroTaken, movieWithHints).availableHints).toEqual([
			'tagline',
			'keywords',
			'poster'
		]);

		const sessionWithOneTaken: GameSessionResponse = {
			...sessionWithZeroTaken,
			taken_hints: [
				{
					id: 'hint-1',
					game_id: 'session-123',
					hint_type: 'tagline',
					unlocked_at_guess: 9,
					created_at: '2026-10-12T00:01:00Z'
				}
			]
		};
		const resultOne = mapGameSessionToClientResponse(sessionWithOneTaken, movieWithHints);
		expect(resultOne.usedHints).toEqual([{ hintType: 'tagline', value: 'Mischief. Mayhem. Soap.' }]);
		expect(resultOne.availableHints).toEqual(['keywords', 'poster']);

		const sessionWithTwoTaken: GameSessionResponse = {
			...sessionWithZeroTaken,
			taken_hints: [
				...sessionWithOneTaken.taken_hints!,
				{
					id: 'hint-2',
					game_id: 'session-123',
					hint_type: 'poster',
					unlocked_at_guess: 9,
					created_at: '2026-10-12T00:02:00Z'
				}
			]
		};
		const resultTwo = mapGameSessionToClientResponse(sessionWithTwoTaken, movieWithHints);
		expect(resultTwo.usedHints).toEqual([
			{ hintType: 'tagline', value: 'Mischief. Mayhem. Soap.' },
			{ hintType: 'poster', value: 'posters/1.webp' }
		]);
		expect(resultTwo.availableHints).toEqual([]);
	});

	it('returns empty availableHints when game is finished even if hint slots were unused', () => {
		const session: GameSessionResponse = {
			...createSession('won'),
			guesses: createWrongGuesses(9)
		};
		const result = mapGameSessionToClientResponse(session, movieWithHints);

		expect(result.availableHints).toEqual([]);
	});
});
