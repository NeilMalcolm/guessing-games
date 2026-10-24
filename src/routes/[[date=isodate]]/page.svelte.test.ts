import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { PageData } from './$types';
import { Match, type GuessResponse, type PropertyResult, type GameSessionClientResponse } from '$lib/types/guess';

const prop = (match: Match): PropertyResult => ({ value: 'test', match });

function createMockGuess(isCorrect: boolean = false, movieId: number = 1): GuessResponse {
	return {
		movieId,
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
	afterEach(() => {
		vi.restoreAllMocks();
	});

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
				guesses: [createMockGuess(false)],
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

	it('calls /movies/give-up when Give Up button is clicked and displays game over state', async () => {
		const giveUpResponse: GameSessionClientResponse = {
			guesses: [],
			gameStatus: 'gave_up',
			targetMovie: { title: 'The Matrix', videoUrl: 'https://www.youtube.com/embed/m8e-679Chvg' }
		};

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (String(url) === '/movies/give-up') {
				return new Response(JSON.stringify(giveUpResponse), { status: 200 });
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});

		render(Page, {
			data: createPageData({
				guesses: [createMockGuess(false)],
				gameStatus: 'in_progress'
			})
		});

		const giveUpBtn = page.getByRole('button', { name: 'Give Up' });
		await giveUpBtn.click();

		// Confirm giving up in the dialog
		const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Give Up' });
		await confirmBtn.click();

		// Failure message must be visible
		await expect.element(page.getByText('Sorry, better luck next time')).toBeInTheDocument();

		// View Results button should have soft error style
		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await expect.element(viewResultsBtn).toBeInTheDocument();
		await expect.element(viewResultsBtn).toHaveClass('btn-soft');
		await expect.element(viewResultsBtn).toHaveClass('btn-error');

		// Modal should display target movie
		await expect.element(page.getByRole('heading', { name: 'Better luck next time' })).toBeInTheDocument();
		await expect.element(page.getByText('The Matrix')).toBeInTheDocument();
	});
});

describe('+page.svelte search bar focus and blur', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const results = [
		{ id: 1, title: 'Dune', imagePath: null },
		{ id: 2, title: 'Dunkirk', imagePath: null }
	];

	function mockSearchFetch() {
		return vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation(
				async () => new Response(JSON.stringify({ ok: true, results }), { status: 200 })
			);
	}

	async function searchFor(term: string) {
		const searchInput = page.getByPlaceholder('Search...');
		await searchInput.fill(term);
		return searchInput;
	}

	it('shows search results while the search bar is focused', async () => {
		mockSearchFetch();
		render(Page, { data: createPageData({}) });

		await searchFor('du');

		await expect.element(page.getByText('Dune', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Dunkirk', { exact: true })).toBeInTheDocument();
	});

	it('hides the search results when the search bar loses focus', async () => {
		mockSearchFetch();
		render(Page, { data: createPageData({}) });

		const searchInput = await searchFor('du');
		await expect.element(page.getByText('Dune', { exact: true })).toBeInTheDocument();

		(searchInput.element() as HTMLInputElement).blur();

		await expect.element(page.getByText('Dune', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByText('Dunkirk', { exact: true })).not.toBeInTheDocument();
	});

	it('shows the previously retrieved results again when the search bar is re-focused', async () => {
		const fetchSpy = mockSearchFetch();
		render(Page, { data: createPageData({}) });

		const searchInput = await searchFor('du');
		await expect.element(page.getByText('Dune', { exact: true })).toBeInTheDocument();
		(searchInput.element() as HTMLInputElement).blur();
		await expect.element(page.getByText('Dune', { exact: true })).not.toBeInTheDocument();
		const callsBeforeRefocus = fetchSpy.mock.calls.length;

		await searchInput.click();

		await expect.element(page.getByText('Dune', { exact: true })).toBeInTheDocument();
		// re-focusing must reuse the earlier results rather than searching again
		expect(fetchSpy.mock.calls.length).toBe(callsBeforeRefocus);
	});

	it('aborts an in-flight search and hides the loading state on blur', async () => {
		let abortedSignal: AbortSignal | undefined;
		vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
			abortedSignal = init?.signal as AbortSignal;
			// never resolves unless aborted
			return new Promise((_resolve, reject) => {
				abortedSignal!.addEventListener('abort', () =>
					reject(new DOMException('Aborted', 'AbortError'))
				);
			});
		});
		render(Page, { data: createPageData({}) });

		const searchInput = await searchFor('du');
		await expect
			.element(page.getByText('Thumbing through film reels...'))
			.toBeInTheDocument();

		(searchInput.element() as HTMLInputElement).blur();

		await expect
			.element(page.getByText('Thumbing through film reels...'))
			.not.toBeInTheDocument();
		expect(abortedSignal?.aborted).toBe(true);
	});

	it('cancels a pending debounced search when blurred before it fires', async () => {
		const fetchSpy = mockSearchFetch();
		render(Page, { data: createPageData({}) });

		const searchInput = await searchFor('du');
		(searchInput.element() as HTMLInputElement).blur();

		// wait longer than the searchbar's default 300ms debounce
		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe('+page.svelte final guess reveal callback', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows view results and opens modal via callback when final guess wins', async () => {
		const guessResponse: GameSessionClientResponse = {
			guesses: [createMockGuess(true)],
			gameStatus: 'won',
			targetMovie: { title: 'Inception', videoUrl: 'https://www.youtube.com/embed/xyz' }
		};

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = String(url);
			if (urlStr.includes('/movies/search')) {
				return new Response(
					JSON.stringify({ results: [{ id: 1, title: 'Inception', imagePath: null }] }),
					{ status: 200 }
				);
			}
			if (urlStr === '/movies/guess') {
				return new Response(JSON.stringify(guessResponse), { status: 200 });
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});

		render(Page, {
			data: createPageData({
				guesses: [],
				gameStatus: 'in_progress'
			}),
			guessRevealDelay: 50,
			resultModalDelay: 50
		});

		const searchInput = page.getByPlaceholder('Search...');
		await searchInput.fill('Inception');

		const searchResultBtn = page.getByRole('button', { name: 'Inception' });
		await searchResultBtn.click();

		// Before reveal finishes, View Results and modal should not yet be shown
		await expect
			.element(page.getByRole('button', { name: 'View Results' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Well done, you guessed right!'))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'You got it!' }))
			.not.toBeInTheDocument();

		// Wait for the reveal animation delay to complete
		await new Promise((resolve) => setTimeout(resolve, 80));

		// Now callback has fired: View Results section should be visible
		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await expect.element(viewResultsBtn).toBeInTheDocument();
		await expect.element(viewResultsBtn).toHaveClass('btn-soft');
		await expect.element(viewResultsBtn).toHaveClass('btn-success');
		await expect
			.element(page.getByText('Well done, you guessed right!'))
			.toBeInTheDocument();

		// Wait for the resultModalDelay to complete
		await new Promise((resolve) => setTimeout(resolve, 80));

		// Modal should now be open displaying win details
		await expect
			.element(page.getByRole('heading', { name: 'You got it!' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('dialog').getByText('Inception')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Copy results' }))
			.toBeInTheDocument();
	});

	it('shows view results and opens modal via callback when final guess loses', async () => {
		const guessResponse: GameSessionClientResponse = {
			guesses: [createMockGuess(false)],
			gameStatus: 'lost',
			targetMovie: { title: 'The Matrix', videoUrl: 'https://www.youtube.com/embed/xyz' }
		};

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = String(url);
			if (urlStr.includes('/movies/search')) {
				return new Response(
					JSON.stringify({ results: [{ id: 2, title: 'Avatar', imagePath: null }] }),
					{ status: 200 }
				);
			}
			if (urlStr === '/movies/guess') {
				return new Response(JSON.stringify(guessResponse), { status: 200 });
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});

		render(Page, {
			data: createPageData({
				guesses: [],
				gameStatus: 'in_progress'
			}),
			guessRevealDelay: 50,
			resultModalDelay: 50
		});

		const searchInput = page.getByPlaceholder('Search...');
		await searchInput.fill('Avatar');

		const searchResultBtn = page.getByRole('button', { name: 'Avatar' });
		await searchResultBtn.click();

		// Before reveal finishes, View Results and modal should not yet be shown
		await expect
			.element(page.getByRole('button', { name: 'View Results' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Sorry, better luck next time'))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Better luck next time' }))
			.not.toBeInTheDocument();

		// Wait for the reveal animation delay to complete
		await new Promise((resolve) => setTimeout(resolve, 80));

		// Now callback has fired: View Results section should be visible
		const viewResultsBtn = page.getByRole('button', { name: 'View Results' });
		await expect.element(viewResultsBtn).toBeInTheDocument();
		await expect.element(viewResultsBtn).toHaveClass('btn-soft');
		await expect.element(viewResultsBtn).toHaveClass('btn-error');
		await expect
			.element(page.getByText('Sorry, better luck next time'))
			.toBeInTheDocument();

		// Wait for the resultModalDelay to complete
		await new Promise((resolve) => setTimeout(resolve, 80));

		// Modal should now be open displaying loss details
		await expect
			.element(page.getByRole('heading', { name: 'Better luck next time' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('dialog').getByText('The Matrix')).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Copy results' }))
			.toBeInTheDocument();
	});

	it('does not show view results or modal when guess is revealed but game is still in progress', async () => {
		const guessResponse: GameSessionClientResponse = {
			guesses: [createMockGuess(false)],
			gameStatus: 'in_progress',
			targetMovie: undefined
		};

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = String(url);
			if (urlStr.includes('/movies/search')) {
				return new Response(
					JSON.stringify({ results: [{ id: 3, title: 'Gladiator', imagePath: null }] }),
					{ status: 200 }
				);
			}
			if (urlStr === '/movies/guess') {
				return new Response(JSON.stringify(guessResponse), { status: 200 });
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});

		render(Page, {
			data: createPageData({
				guesses: [],
				gameStatus: 'in_progress'
			}),
			guessRevealDelay: 50,
			resultModalDelay: 50
		});

		const searchInput = page.getByPlaceholder('Search...');
		await searchInput.fill('Gladiator');

		const searchResultBtn = page.getByRole('button', { name: 'Gladiator' });
		await searchResultBtn.click();

		// Wait for reveal animation delay and modal delay
		await new Promise((resolve) => setTimeout(resolve, 160));

		// View Results button should not be shown
		await expect
			.element(page.getByRole('button', { name: 'View Results' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Well done, you guessed right!'))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Sorry, better luck next time'))
			.not.toBeInTheDocument();
	});

	it('renders multiple guesses with identical titles without throwing error', async () => {
		// two 'Inception' movies.
		const guess1 = createMockGuess(false);
		const guess2 = createMockGuess(false);

		render(Page, {
			data: createPageData({
				guesses: [guess1, guess2],
				gameStatus: 'in_progress'
			})
		});

		const guessTiles = page.getByTestId('guess-tile');
		expect(guessTiles.elements()).toHaveLength(2);

		const headings = page.getByRole('heading', { name: 'Inception' });
		expect(headings.elements()).toHaveLength(2);

		await expect.element(guessTiles.first()).toBeInTheDocument();
		await expect.element(guessTiles.nth(1)).toBeInTheDocument();
	});

	it('cannot select search result for a previously-guessed movie', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = String(url);
			if (urlStr.includes('/movies/search')) {
				return new Response(
					JSON.stringify({
						results: [
							{ id: 42, title: 'Inception', imagePath: null },
							{ id: 99, title: 'Interstellar', imagePath: null }
						]
					}),
					{ status: 200 }
				);
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});

		const previousGuess = createMockGuess(false, 42);

		render(Page, {
			data: createPageData({
				guesses: [previousGuess],
				gameStatus: 'in_progress'
			})
		});

		const searchInput = page.getByPlaceholder('Search...');
		await searchInput.fill('Inception');

		// Search result for the already-guessed movie shows indicator
		await expect.element(page.getByText('Already guessed...')).toBeInTheDocument();

		// Clicking the already-guessed movie result button
		const alreadyGuessedBtn = page.getByRole('button', { name: /Already guessed/i });
		await alreadyGuessedBtn.click();

		// Clicking an already guessed movie must not trigger a guess submission
		const guessCalls = fetchSpy.mock.calls.filter(([url]) =>
			String(url).includes('/movies/guess')
		);
		expect(guessCalls).toHaveLength(0);

		// Dropdown remains open and no additional guess tile was added
		await expect.element(page.getByText('Already guessed...')).toBeInTheDocument();
		const guessTiles = page.getByTestId('guess-tile');
		expect(guessTiles.elements()).toHaveLength(1);
	});
});
