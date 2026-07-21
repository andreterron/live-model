import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'node:path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/explorer',
  plugins: [
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    cssCodeSplit: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        styles: 'src/styles.css',
        'react-router': 'src/react-router.ts',
        'route-layout': 'src/routes/layout.tsx',
        'route-index': 'src/routes/index.tsx',
        'route-entry': 'src/routes/entry.tsx',
      },
      cssFileName: 'styles',
      formats: ['es'],
    },
    rollupOptions: {
      external: (source: string) => !source.match(/\.[tj]sx?$/),
      output: { entryFileNames: '[name].js' },
    },
  },
});
