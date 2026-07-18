/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { cpSync } from 'node:fs';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/api',
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
      entry: {
        index: 'src/index.ts',
        server: 'src/server.ts',
      },
      name: 'api',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (source: string) => !source.match(/\.[tj]sx?$/),
      output: {
        banner: (chunk) =>
          chunk.name === 'server' ? '#!/usr/bin/env node' : '',
      },
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
  },
}));
