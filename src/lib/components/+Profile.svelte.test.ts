import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Profile from './+Profile.svelte';
import { Match, type CastPropertyResult } from '$lib/types/guess';

describe('+Profile.svelte', () => {
	it('renders profile picture image when image is present', async () => {
		const castMember: CastPropertyResult = {
			value: 'Brad Pitt',
			image: 'https://image.tmdb.org/t/p/w185/brad.jpg',
			match: Match.Exact
		};

		render(Profile, {
			castMember,
			success: false,
			revealed: true
		});

		const img = page.getByRole('img', { name: 'Profile picture for Brad Pitt' });
		await expect.element(img).toBeInTheDocument();
		await expect.element(img).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w185/brad.jpg');
		await expect.element(page.getByText('Brad Pitt')).toBeInTheDocument();
	});

	it('renders avatar placeholder initials when image is null', async () => {
		const castMember: CastPropertyResult = {
			value: 'Brad Pitt',
			image: null,
			match: Match.None
		};

		render(Profile, {
			castMember,
			success: false,
			revealed: true
		});

		const img = page.getByRole('img', { name: 'Profile picture for Brad Pitt' });
		await expect.element(img).not.toBeInTheDocument();
		await expect.element(page.getByText('BP')).toBeInTheDocument();
		await expect.element(page.getByText('Brad Pitt')).toBeInTheDocument();
	});

	it('applies ring-success styling when match is exact and revealed is true', async () => {
		const castMember: CastPropertyResult = {
			value: 'Brad Pitt',
			image: null,
			match: Match.Exact
		};

		render(Profile, {
			castMember,
			success: false,
			revealed: true
		});

		const placeholder = page.getByText('BP');
		await expect.element(placeholder).toBeInTheDocument();
		const parent = placeholder.element().parentElement;
		expect(parent?.className).toContain('ring-success');
	});
});

