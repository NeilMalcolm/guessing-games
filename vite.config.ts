import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sentrySvelteKit } from '@sentry/sveltekit';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [
			sentrySvelteKit({
				sourceMapsUploadOptions: {
					org: 'none-kdt',
					project: 'guessing-games',
					authToken: env.SENTRY_AUTH_TOKEN,
					...(process.env.VITEST ? { telemetry: false } : {})
				}
			}),
			tailwindcss(),
			/* let's us use the svelte.config, so we can use experimental instrumentation values */
			sveltekit()
		],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
	};
});
