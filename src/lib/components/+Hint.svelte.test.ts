import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Hint from './+Hint.svelte';
import { HINT_TYPE_KEYWORDS, HINT_TYPE_POSTER, HINT_TYPE_TAGLINE } from '$lib/types/supabasetables';
import type { UsedHint } from '$lib/types/guess';

describe('+Hint.svelte', () => {
	it('renders tagline hint wrapped in quotes', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_TAGLINE,
			value: 'In space no one can hear you scream.',
			unlockedAtGuess: 2
		};

		render(Hint, { hint, showPosterModal: false });

		await expect
			.element(page.getByText('"In space no one can hear you scream."'))
			.toBeInTheDocument();
	});

	it('renders keywords hint as individual badges', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_KEYWORDS,
			value: ['space', 'alien', 'survival'],
			unlockedAtGuess: 3
		};

		render(Hint, { hint, showPosterModal: false });

		await expect.element(page.getByText('space')).toBeInTheDocument();
		await expect.element(page.getByText('alien')).toBeInTheDocument();
		await expect.element(page.getByText('survival')).toBeInTheDocument();
	});

	it('renders View Poster button for poster hint with modal closed', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_POSTER,
			value: 'https://example.com/pixelated-poster.png',
			unlockedAtGuess: 4
		};

		render(Hint, { hint, showPosterModal: false });

		await expect.element(page.getByRole('button', { name: 'View Poster' })).toBeVisible();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('opens the poster modal and displays the pixelated poster when View Poster is clicked', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_POSTER,
			value: 'https://example.com/pixelated-poster.png',
			unlockedAtGuess: 4
		};

		render(Hint, { hint, showPosterModal: false });

		await page.getByRole('button', { name: 'View Poster' }).click();

		await expect.element(page.getByRole('heading', { name: 'Poster' })).toBeVisible();
		const img = page.getByAltText('Pixelated poster');
		await expect.element(img).toBeVisible();
		await expect
			.element(img)
			.toHaveAttribute('src', 'https://example.com/pixelated-poster.png');
	});

	it('displays the poster modal immediately when showPosterModal is true', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_POSTER,
			value: 'https://example.com/pixelated-poster.png',
			unlockedAtGuess: 4
		};

		render(Hint, { hint, showPosterModal: true });

		await expect.element(page.getByRole('heading', { name: 'Poster' })).toBeVisible();
		await expect.element(page.getByAltText('Pixelated poster')).toBeVisible();
	});

	it('does not render poster image when hint value is empty', async () => {
		const hint: UsedHint = {
			hintType: HINT_TYPE_POSTER,
			value: '',
			unlockedAtGuess: 4
		};

		render(Hint, { hint, showPosterModal: true });

		await expect.element(page.getByRole('heading', { name: 'Poster' })).toBeVisible();
		await expect.element(page.getByAltText('Pixelated poster')).not.toBeInTheDocument();
	});
});
