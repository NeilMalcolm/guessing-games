import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SearchResults from './+SearchResults.svelte';
import type { SearchResponse, SearchResult } from '$lib/types/search';

function renderSearchResults(overrides: {
	isActive?: boolean;
	isSearching?: boolean;
	searchResults?: SearchResponse | null;
	onResultClicked?: (result: SearchResult) => void;
} = {}) {
	const onResultClicked = overrides.onResultClicked ?? vi.fn();
	render(SearchResults, {
		isActive: true,
		isSearching: false,
		searchResults: null,
		...overrides,
		onResultClicked
	});
	return { onResultClicked };
}

describe('+SearchResults.svelte', () => {
	it('renders nothing when isActive is false', async () => {
		renderSearchResults({
			isActive: false,
			isSearching: true,
			searchResults: { results: [{ id: 1, title: 'Dune', imagePath: null }] }
		});

		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
		await expect.element(page.getByText('Thumbing through film reels...')).not.toBeInTheDocument();
		await expect.element(page.getByText('Dune')).not.toBeInTheDocument();
	});

	it('renders nothing when isActive is true but not searching and searchResults is null', async () => {
		renderSearchResults({
			isActive: true,
			isSearching: false,
			searchResults: null
		});

		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
	});

	it('renders loading indicator when isActive and isSearching are true and searchResults is null', async () => {
		renderSearchResults({
			isActive: true,
			isSearching: true,
			searchResults: null
		});

		await expect.element(page.getByRole('list')).toBeInTheDocument();
		await expect.element(page.getByText('Thumbing through film reels...')).toBeVisible();
	});

	it('renders "No results found" when searchResults has an empty results array', async () => {
		renderSearchResults({
			isActive: true,
			isSearching: false,
			searchResults: { results: [] }
		});

		await expect.element(page.getByText('No results found')).toBeVisible();
		await expect.element(page.getByText('Thumbing through film reels...')).not.toBeInTheDocument();
	});

	it('renders search results with titles and poster images when present', async () => {
		renderSearchResults({
			searchResults: {
				results: [
					{ id: 1, title: 'Inception', imagePath: 'https://example.com/inception.jpg' },
					{ id: 2, title: 'Dunkirk', imagePath: null }
				]
			}
		});

		await expect.element(page.getByRole('button', { name: /Inception/ })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Dunkirk' })).toBeVisible();

		const poster = page.getByAltText('Poster for Inception');
		await expect.element(poster).toBeVisible();
		await expect.element(poster).toHaveAttribute('src', 'https://example.com/inception.jpg');
		await expect.element(page.getByAltText('Poster for Dunkirk')).not.toBeInTheDocument();
	});

	it('renders "Already guessed" indicator for results marked alreadyGuessed', async () => {
		renderSearchResults({
			searchResults: {
				results: [
					{ id: 1, title: 'Inception', imagePath: null, alreadyGuessed: true },
					{ id: 2, title: 'Interstellar', imagePath: null, alreadyGuessed: false }
				]
			}
		});

		await expect.element(page.getByText('Already guessed')).toBeVisible();
		expect(page.getByText('Already guessed').elements()).toHaveLength(1);
	});

	it('calls onResultClicked with the clicked result when not already guessed', async () => {
		const dune: SearchResult = { id: 42, title: 'Dune', imagePath: null };
		const { onResultClicked } = renderSearchResults({
			searchResults: { results: [dune] }
		});

		await page.getByRole('button', { name: 'Dune' }).click();

		expect(onResultClicked).toHaveBeenCalledTimes(1);
		expect(onResultClicked).toHaveBeenCalledWith(dune);
	});

	it('does not call onResultClicked when clicking an already-guessed result', async () => {
		const guessedMovie: SearchResult = {
			id: 42,
			title: 'Inception',
			imagePath: null,
			alreadyGuessed: true
		};
		const { onResultClicked } = renderSearchResults({
			searchResults: { results: [guessedMovie] }
		});

		await page.getByRole('button', { name: /Inception/ }).click();

		expect(onResultClicked).not.toHaveBeenCalled();
	});

	it('prevents default on mousedown on the results list to preserve input focus', async () => {
		renderSearchResults({
			searchResults: {
				results: [{ id: 1, title: 'Dune', imagePath: null }]
			}
		});

		const list = page.getByRole('list').element();
		const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		const notCancelled = list.dispatchEvent(mousedownEvent);

		expect(notCancelled).toBe(false);
		expect(mousedownEvent.defaultPrevented).toBe(true);
	});
});
