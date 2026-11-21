import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TakeHintSection from './+TakeHintSection.svelte';
import { HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER, HINT_TYPE_TAGLINE } from '$lib/types/supabasetables';
import type { AvailableHints, UsedHint } from '$lib/types/guess';

describe('+TakeHintSection.svelte', () => {
	it('renders singular message when 1 hint is unlocked', async () => {
		const availableHints: AvailableHints = {
			unusedHintsCount: 1,
			hints: [HINT_TYPE_TAGLINE, HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER]
		};

		render(TakeHintSection, {
			availableHints,
			usedHints: [],
			onHintButtonClick: vi.fn(),
			takeHint: vi.fn(),
			showChooseHintModal: false
		});

		await expect.element(page.getByText('You have unlocked a hint.')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Get Hint' })).toBeVisible();
	});

	it('renders plural message when multiple hints are unlocked', async () => {
		const availableHints: AvailableHints = {
			unusedHintsCount: 2,
			hints: [HINT_TYPE_TAGLINE, HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER]
		};

		render(TakeHintSection, {
			availableHints,
			usedHints: [],
			onHintButtonClick: vi.fn(),
			takeHint: vi.fn(),
			showChooseHintModal: false
		});

		await expect.element(page.getByText('You have unlocked hints.')).toBeInTheDocument();
	});

	it('calls onHintButtonClick when Get Hint button is clicked', async () => {
		const onHintButtonClick = vi.fn();

		render(TakeHintSection, {
			availableHints: { unusedHintsCount: 1, hints: [HINT_TYPE_TAGLINE] },
			usedHints: [],
			onHintButtonClick,
			takeHint: vi.fn(),
			showChooseHintModal: false
		});

		await page.getByRole('button', { name: 'Get Hint' }).click();

		expect(onHintButtonClick).toHaveBeenCalledOnce();
	});

	it('keeps the choose hint modal hidden when showChooseHintModal is false', async () => {
		render(TakeHintSection, {
			availableHints: { unusedHintsCount: 1, hints: [HINT_TYPE_TAGLINE] },
			usedHints: [],
			onHintButtonClick: vi.fn(),
			takeHint: vi.fn(),
			showChooseHintModal: false
		});

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('renders formatted hint options inside the modal and calls takeHint when clicked', async () => {
		const takeHint = vi.fn();
		const availableHints: AvailableHints = {
			unusedHintsCount: 2,
			hints: [HINT_TYPE_TAGLINE, HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER]
		};

		render(TakeHintSection, {
			availableHints,
			usedHints: [],
			onHintButtonClick: vi.fn(),
			takeHint,
			showChooseHintModal: true
		});

		await expect.element(page.getByRole('heading', { name: 'Need a Hint?' })).toBeVisible();
		await expect
			.element(page.getByText('Choose from the following hint options:'))
			.toBeVisible();

		const taglineBtn = page.getByRole('button', { name: 'Tagline' });
		const keywordsBtn = page.getByRole('button', { name: 'Keywords' });
		const posterBtn = page.getByRole('button', { name: 'Poster' });

		await expect.element(taglineBtn).toBeEnabled();
		await expect.element(keywordsBtn).toBeEnabled();
		await expect.element(posterBtn).toBeEnabled();

		await keywordsBtn.click();
		expect(takeHint).toHaveBeenCalledWith(HINT_TYPE_KEYWORDS);
	});

	it('disables hint options that have already been used', async () => {
		const takeHint = vi.fn();
		const availableHints: AvailableHints = {
			unusedHintsCount: 1,
			hints: [HINT_TYPE_TAGLINE, HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER]
		};
		const usedHints: UsedHint[] = [
			{
				hintType: HINT_TYPE_TAGLINE,
				value: 'Some tagline',
				unlockedAtGuess: 2
			}
		];

		render(TakeHintSection, {
			availableHints,
			usedHints,
			onHintButtonClick: vi.fn(),
			takeHint,
			showChooseHintModal: true
		});

		const taglineBtn = page.getByRole('button', { name: 'Tagline' });
		const keywordsBtn = page.getByRole('button', { name: 'Keywords' });

		await expect.element(taglineBtn).toBeDisabled();
		await expect.element(taglineBtn).toHaveClass('disabled');
		await expect.element(keywordsBtn).toBeEnabled();
	});

	it('closes the modal when No Thanks is clicked', async () => {
		render(TakeHintSection, {
			availableHints: { unusedHintsCount: 1, hints: [HINT_TYPE_TAGLINE] },
			usedHints: [],
			onHintButtonClick: vi.fn(),
			takeHint: vi.fn(),
			showChooseHintModal: true
		});

		await expect.element(page.getByRole('heading', { name: 'Need a Hint?' })).toBeVisible();

		await page.getByRole('button', { name: 'No Thanks' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
});
