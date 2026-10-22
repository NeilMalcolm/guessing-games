import '../../app.css';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeModeToggle from './+ThemeModeToggle.svelte';

function setTheme(theme: 'light' | 'dark') {
	document.documentElement.setAttribute('data-theme', theme);
}

/** The sun is the swap-on icon, the moon is the swap-off icon. */
function icons(container: HTMLElement) {
	return {
		sun: container.querySelector('.swap-on') as SVGElement,
		moon: container.querySelector('.swap-off') as SVGElement
	};
}

describe('+ThemeModeToggle.svelte', () => {
	beforeEach(() => localStorage.removeItem('theme'));

	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
		localStorage.removeItem('theme');
	});

	it('shows the sun icon and hides the moon in light mode', async () => {
		setTheme('light');
		const { container } = render(ThemeModeToggle);
		const { sun, moon } = icons(container);

		await expect.element(sun).toHaveStyle({ opacity: '1' });
		await expect.element(moon).toHaveStyle({ opacity: '0' });
	});

	it('shows the moon icon and hides the sun in dark mode', async () => {
		setTheme('dark');
		const { container } = render(ThemeModeToggle);
		const { sun, moon } = icons(container);

		await expect.element(moon).toHaveStyle({ opacity: '1' });
		await expect.element(sun).toHaveStyle({ opacity: '0' });
	});

	it('switches from the sun to the moon when clicked in light mode', async () => {
		setTheme('light');
		const { container } = render(ThemeModeToggle);
		const { sun, moon } = icons(container);

		await page.getByRole('button', { name: 'Toggle light/dark mode' }).click();

		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		expect(localStorage.getItem('theme')).toBe('dark');
		await expect.element(moon).toHaveStyle({ opacity: '1' });
		await expect.element(sun).toHaveStyle({ opacity: '0' });
	});

	it('switches from the moon to the sun when clicked in dark mode', async () => {
		setTheme('dark');
		const { container } = render(ThemeModeToggle);
		const { sun, moon } = icons(container);

		await page.getByRole('button', { name: 'Toggle light/dark mode' }).click();

		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		expect(localStorage.getItem('theme')).toBe('light');
		await expect.element(sun).toHaveStyle({ opacity: '1' });
		await expect.element(moon).toHaveStyle({ opacity: '0' });
	});

	it('keeps the icon in sync over repeated clicks', async () => {
		setTheme('light');
		const { container } = render(ThemeModeToggle);
		const { sun, moon } = icons(container);
		const button = page.getByRole('button', { name: 'Toggle light/dark mode' });

		await button.click();
		await button.click();
		await button.click();

		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		await expect.element(moon).toHaveStyle({ opacity: '1' });
		await expect.element(sun).toHaveStyle({ opacity: '0' });
	});
});

