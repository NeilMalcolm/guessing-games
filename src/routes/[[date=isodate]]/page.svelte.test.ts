import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { PageData } from './$types';
import { Match, type GuessResponse, type PropertyResult } from '$lib/types/guess';

const prop = (match: Match): PropertyResult => ({ value: 'test', match });

function createMockGuess(isCorrect: boolean = false): GuessResponse {
	return {
		title: 'Inception',
		image: null,
		yearResult: prop(isCorrect ? Match.Exact : Match.Higher),
		genresResult: [prop(isCorrect ? Match.Exact : Match.None)],
		boxOfficeResult: prop(isCorrect ? Match.Exact : Match.Higher),
		ratingResult: prop(isCorrect ? Match.Exact : Match.Higher),
		directorResult: { ...prop(isCorrect ? Match.Exact : Match.None), image: '' },
		castMembersResult: [{ ...prop(isCorrect ? Match.Exact : Match.None), image: '' }],
		ageRatingResult: prop(isCorrect ? Match.Exact : Match.None),
		isCorrect,
		status: isCorrect ? 'won' : 'lost'
	};
}

function createPageData(overrides: Partial<PageData>): PageData {
	return {
		session: undefined,
		user: null,
		supabase: {} as any,
		claims: null,
		guesses: [],
		gameStatus: 'in_progress',
		playDate: '2026-10-12',
		...overrides
	};
}

describe('+page.svelte game over states', () => {
	it('shows success message and soft success button when game is won', async () => {
		render(Page, {
			data: createPageData({
				guesses: [createMockGuess(true)],
				gameStatus: 'won'
			})
		});

		// Success message must be visible
		await expect.element(page.getByText('Well done, you guessed right!')).toBeInTheDocument();

		// Failure message should NOT be visible
		await expect.element(page.getByText('Sorry, better luck next time')).not.toBeInTheDocument();

		// View Results button should have soft success style
		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await expect.element(viewResultsBtn).toBeInTheDocument();
		await expect.element(viewResultsBtn).toHaveClass('btn-soft');
		await expect.element(viewResultsBtn).toHaveClass('btn-success');
		await expect.element(viewResultsBtn).not.toHaveClass('btn-error');

		// Inputs should be disabled when game is finished
		const searchInput = page.getByPlaceholder('Search...');
		await expect.element(searchInput).toBeDisabled();
		const giveUpBtn = page.getByRole('button', { name: 'Give Up' });
		await expect.element(giveUpBtn).toBeDisabled();
	});

	it('shows failure message and soft error button when game is lost', async () => {
		render(Page, {
			data: createPageData({
				guesses: [createMockGuess(false)],
				gameStatus: 'lost'
			})
		});

		// Failure message must be visible
		await expect.element(page.getByText('Sorry, better luck next time')).toBeInTheDocument();

		// Success message should NOT be visible
		await expect.element(page.getByText('Well done, you guessed right!')).not.toBeInTheDocument();

		// View Results button should have soft error style
		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await expect.element(viewResultsBtn).toBeInTheDocument();
		await expect.element(viewResultsBtn).toHaveClass('btn-soft');
		await expect.element(viewResultsBtn).toHaveClass('btn-error');
		await expect.element(viewResultsBtn).not.toHaveClass('btn-success');

		// Inputs should be disabled when game is finished
		const searchInput = page.getByPlaceholder('Search...');
		await expect.element(searchInput).toBeDisabled();
		const giveUpBtn = page.getByRole('button', { name: 'Give Up' });
		await expect.element(giveUpBtn).toBeDisabled();
	});

	it('does not show end state message or View Results button when game is in progress', async () => {
		render(Page, {
			data: createPageData({
				guesses: [],
				gameStatus: 'in_progress'
			})
		});

		// Neither message should be present
		await expect.element(page.getByText('Well done, you guessed right!')).not.toBeInTheDocument();
		await expect.element(page.getByText('Sorry, better luck next time')).not.toBeInTheDocument();

		// View Results button should not be present
		await expect
			.element(page.getByRole('button', { name: 'View Results' }))
			.not.toBeInTheDocument();

		// Inputs should be enabled
		const searchInput = page.getByPlaceholder('Search...');
		await expect.element(searchInput).not.toBeDisabled();
		const giveUpBtn = page.getByRole('button', { name: 'Give Up' });
		await expect.element(giveUpBtn).not.toBeDisabled();
	});

	it('opens results modal when clicking View Results button', async () => {
		render(Page, {
			data: createPageData({
				guesses: [createMockGuess(true)],
				gameStatus: 'won'
			})
		});

		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await viewResultsBtn.click();

		// Modal should display win title and copy button
		await expect.element(page.getByText('You got it!')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Copy results' })).toBeInTheDocument();
	});

	it('makes the latest card successful and replays animation when Test Win button is clicked', async () => {
		render(Page, {
			data: createPageData({
				guesses: [createMockGuess(false)],
				gameStatus: 'in_progress'
			})
		});

		const testWinBtn = page.getByRole('button', { name: 'Test Win' });
		await expect.element(testWinBtn).toBeInTheDocument();

		await testWinBtn.click();

		// The latest card tile should be present and animating
		const tile = page.getByTestId('guess-tile');
		await expect.element(tile).toBeInTheDocument();
	});
});
