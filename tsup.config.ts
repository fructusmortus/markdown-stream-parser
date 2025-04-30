import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/markdown-stream-parser.ts'],
  dts: true,
  format: ['esm', 'cjs'],
  minify: true,
  outDir: 'build',
  clean: true,
  sourcemap: true,
  target: 'es2015',
  esbuildOptions(options) {
    options.plugins = [
      {
        name: 'fix-ts-extensions',
        setup(build) {
          build.onResolve({ filter: /\.ts$/ }, args => {
            if (args.path.startsWith('.')) {
              return { path: args.path.replace(/\.ts$/, '.js'), external: false }
            }
          });
        }
      }
    ];
  }
});
