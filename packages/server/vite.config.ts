import { cpSync } from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/server',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    {
      name: 'copy-public-directory',
      closeBundle() {
        cpSync(path.join(__dirname, 'public'), path.join(__dirname, 'dist/public'), {
          recursive: true,
        });
      },
    },
  ],
  clearScreen: false,
  publicDir: false,
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'server',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (source: string) => !source.match(/\.[tj]sx?$/),
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
}));
