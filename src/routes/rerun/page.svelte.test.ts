import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { PageData } from './$types';

type RerunDay = PageData['rerunDays'][number];

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const days: RerunDay[] = [
	{ playDate: yesterday, status: 'won', poster: 'https://example.com/won.jpg' },
	{ playDate: '2026-01-05', status: 'lost', poster: 'https://example.com/lost.jpg' },
	{ playDate: '2026-01-04', status: 'in_progress', poster: null },
	{ playDate: '2026-01-03', status: null, poster: null }
];

function renderPage(rerunDays: RerunDay[] = days) {
	return render(Page, {
		data: {
			session: undefined,
			user: null,
			supabase: {} as any,
			claims: null,
			rerunDays
		} as PageData,
		params: {},
		form: null
	});
}

describe('rerun +page.svelte', () => {
	it('renders the heading and a link for every day', async () => {
		renderPage();
		await expect.element(page.getByRole('heading', { name: 'Reruns' })).toBeVisible();
		await expect.element(page.getByRole('link').nth(3)).toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(4);
	});

	it('links each day to its play date', async () => {
		renderPage();
		await expect.element(page.getByRole('link').nth(1)).toHaveAttribute('href', '/2026-01-05');
	});

	it('labels yesterday and formats other dates as day and month', async () => {
		renderPage();
		await expect.element(page.getByText('Yesterday')).toBeVisible();
		await expect.element(page.getByText('05 Jan')).toBeVisible();
	});

	it('only shows posters when provided', async () => {
		renderPage();
		expect(page.getByRole('img').elements()).toHaveLength(2);
		await expect
			.element(page.getByRole('img', { name: 'Poster for 2026-01-05' }))
			.toHaveAttribute('src', 'https://example.com/lost.jpg');
	});

	it('colours won and lost days', async () => {
		renderPage();
		await expect.element(page.getByRole('link').nth(0)).toHaveClass(/bg-success/);
		await expect.element(page.getByRole('link').nth(1)).toHaveClass(/bg-error/);
		await expect.element(page.getByRole('link').nth(3)).toHaveClass(/bg-base-200/);
	});

	it('defaults to the All filter', async () => {
		renderPage();
		await expect.element(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
	});

	it('Played filter shows only won and lost days', async () => {
		renderPage();
		await page.getByRole('radio', { name: 'Played', exact: true }).click();
		expect(page.getByRole('link').elements()).toHaveLength(2);
		await expect.element(page.getByText('05 Jan')).toBeVisible();
	});

	it('Unplayed filter shows in-progress and unplayed days', async () => {
		renderPage();
		await page.getByRole('radio', { name: 'Unplayed' }).click();
		expect(page.getByRole('link').elements()).toHaveLength(2);
		await expect.element(page.getByText('04 Jan')).toBeVisible();
		await expect.element(page.getByText('03 Jan')).toBeVisible();
	});

	it('renders no links when there are no days', async () => {
		renderPage([]);
		await expect.element(page.getByRole('heading', { name: 'Reruns' })).toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});
});
