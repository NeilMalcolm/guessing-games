import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Searchbar from './+Searchbar.svelte';

const DEBOUNCE_MS = 20;

function renderSearchbar(overrides: Record<string, unknown> = {}) {
	const handlers = {
		onSearch: vi.fn(),
		onClear: vi.fn(),
		onBlur: vi.fn(),
		onFocus: vi.fn()
	};
	render(Searchbar, { ...handlers, debounceTime: DEBOUNCE_MS, ...overrides });
	return { ...handlers, input: page.getByPlaceholder('Search...') };
}

describe('+Searchbar.svelte focus and blur', () => {
	it('calls onFocus when the input is focused', async () => {
		const { input, onFocus, onBlur } = renderSearchbar();

		await input.click();

		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).not.toHaveBeenCalled();
	});

	it('calls onBlur when the input loses focus', async () => {
		const { input, onBlur } = renderSearchbar();

		await input.click();
		(input.element() as HTMLInputElement).blur();

		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it('calls onFocus again when the input is re-focused after a blur', async () => {
		const { input, onFocus, onBlur } = renderSearchbar();

		await input.click();
		(input.element() as HTMLInputElement).blur();
		await input.click();

		expect(onFocus).toHaveBeenCalledTimes(2);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it('cancels a pending debounced search when the input is blurred', async () => {
		const { input, onSearch } = renderSearchbar();

		await input.fill('inception');
		(input.element() as HTMLInputElement).blur();

		// wait comfortably longer than the debounce
		await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 5));

		expect(onSearch).not.toHaveBeenCalled();
	});

	it('still searches after the debounce when the input stays focused', async () => {
		const { input, onSearch } = renderSearchbar();

		await input.fill('inception');

		await vi.waitFor(() => expect(onSearch).toHaveBeenCalledWith('inception'));
	});
});

