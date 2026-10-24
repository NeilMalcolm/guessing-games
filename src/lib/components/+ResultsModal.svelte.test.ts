import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ResultsModal from './+ResultsModal.svelte';
import { getResultRows } from '$lib/utils/resultSquares';
import { Match, type GuessResponse, type PropertyResult, type TargetMovie } from '$lib/types/guess';

const prop = (match: Match): PropertyResult => ({ value: 'test', match });

const targetMovie: TargetMovie = {
	title: 'Interstellar',
	videoUrl: 'https://www.example.com/embed/12345'
};

function createGuess(overrides: Partial<GuessResponse> = {}): GuessResponse {
	return {
		movieId: 1,
		title: 'Interstellar',
		image: null,
		yearResult: prop(Match.Higher),
		genresResult: [prop(Match.None)],
		boxOfficeResult: prop(Match.Higher),
		ratingResult: prop(Match.Higher),
		directorResult: { ...prop(Match.None), image: '' },
		castMembersResult: [{ ...prop(Match.None), image: '' }],
		ageRatingResult: prop(Match.None),
		isCorrect: false,
		status: 'in_progress',
		...overrides
	};
}

describe('+ResultsModal.svelte', () => {
	beforeEach(() => {
		if (navigator.clipboard) {
			vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		} else {
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText: vi.fn().mockResolvedValue(undefined) },
				configurable: true
			});
		}
	});

	it('renders win state heading and guess rows correctly', async () => {
		const guess1 = createGuess({
			genresResult: [prop(Match.Exact)],
			yearResult: prop(Match.LowerClose)
		});
		const guess2 = createGuess({
			isCorrect: true,
			status: 'won'
		});

		// Server returns newest first: [guess2, guess1]
		const guesses = [guess2, guess1];
		const expectedRows = getResultRows(guesses);

		render(ResultsModal, {
			open: true,
			guesses,
			won: true,
			playDate: '2026-10-12',
			targetMovie
		});

		// Heading for win
		await expect.element(page.getByText('You got it!')).toBeInTheDocument();
		await expect.element(page.getByText('2 guesses')).toBeInTheDocument();

		// Each row of emoji squares should be present in the ordered list
		const list = page.getByRole('list', { name: 'Your guesses' });
		await expect.element(list).toBeInTheDocument();

		for (const row of expectedRows) {
			await expect.element(list.getByText(row)).toBeInTheDocument();
		}
	});

	it('renders loss state heading with singular guess count', async () => {
		const guess = createGuess({ status: 'lost' });

		render(ResultsModal, {
			open: true,
			guesses: [guess],
			won: false,
			playDate: '2026-10-12',
			targetMovie
		});

		await expect.element(page.getByText('Better luck next time')).toBeInTheDocument();
		await expect.element(page.getByText('1 guess')).toBeInTheDocument();
	});

	it('copies formatted text to clipboard and updates button text when clicked', async () => {
		const guesses = [createGuess({ isCorrect: true, status: 'won' })];

		render(ResultsModal, {
			open: true,
			guesses,
			won: true,
			playDate: '2026-10-12',

			targetMovie: {
				title: 'Interstellar',
				videoUrl: 'https://www.example.com/embed/12345'
			}
		});

		const copyBtn = page.getByRole('button', { name: 'Copy results' });
		await copyBtn.click();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining('Guessing Games 2026-10-12 - 1 guess')
		);
		await expect.element(page.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
	});

	it('renders movie title and video iframe when targetMovie is provided', async () => {
		const guesses = [createGuess({ isCorrect: true, status: 'won' })];

		render(ResultsModal, {
			open: true,
			guesses,
			won: true,
			playDate: '2026-10-12',

			targetMovie: {
				title: 'The Matrix',
				videoUrl: 'https://www.example.com/embed/12345'
			}
		});

		await expect.element(page.getByText('The Matrix')).toBeInTheDocument();
		const iframe = page.getByTitle('Embed videos and playlists');
		await expect.element(iframe).toBeInTheDocument();
		await expect.element(iframe).toHaveAttribute('src', 'https://www.example.com/embed/12345');
	});
	it('does not render video iframe when targetMovie videoUrl is null', async () => {
		const guesses = [createGuess({ isCorrect: true, status: 'won' })];

		render(ResultsModal, {
			open: true,
			guesses,
			won: true,
			playDate: '2026-10-12',

			targetMovie: {
				title: 'The Matrix',
				videoUrl: null
			}
		});

		await expect.element(page.getByText('The Matrix')).toBeInTheDocument();
		const iframe = page.getByTitle('Embed videos and playlists');
		await expect.element(iframe).not.toBeInTheDocument();
	});
});
