import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use the static adapter for static site generation
		adapter: adapter({
			// Output directory (default: build)
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // Specify fallback for SPA behavior
			precompress: false,
			strict: false // Keep strict false for now
		})
	}
};

export default config;
