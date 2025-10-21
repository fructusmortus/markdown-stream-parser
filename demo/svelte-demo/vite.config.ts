import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: ['..']
		}
	},
	optimizeDeps: {
		exclude: ['web-tree-sitter']
	},
	resolve: {
		alias: {
			'web-tree-sitter': path.resolve(__dirname, 'node_modules/web-tree-sitter')
		}
	}
});
