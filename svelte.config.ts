import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
    preprocess: vitePreprocess(),
    compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: true
    },
    kit: {
        adapter: adapter(),
        experimental: {
            instrumentation: {
                server: true
            },
            tracing: {
                server: true
            }
        }
    }
};

export default config;

