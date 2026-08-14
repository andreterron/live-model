import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/website',
  resolve: {
    // `live-model` is a linked workspace package whose compiled entry imports
    // React. Keep its hooks on the same React instance as this application.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // The tunnel can keep a browser tab alive while workspace packages rebuild.
    // Discovering another dependency later changes Vite's browser hash, which can
    // leave that tab running React and React DOM from different optimizer runs.
    // React is the only CommonJS dependency that needs pre-bundling here; ESM
    // dependencies can continue to load directly without late re-optimization.
    noDiscovery: true,
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
    ],
  },
  server: {
    port: Number(process.env.PORT ?? 4200),
    strictPort: process.env.PORT !== undefined,
    host: 'localhost',
    proxy: {
      // The public tunnel forwards every websocket to this website process.
      // Give Live Model a distinct path so Vite can forward it to the protocol
      // server without interfering with Vite's own HMR websocket.
      '/live-model': {
        target: `ws://127.0.0.1:${
          process.env.LIVE_MODEL_SERVER_PORT ?? '3001'
        }`,
        ws: true,
      },
    },
    // Every module is mutable while the workspace watch builds are running.
    // In particular, /@fs package output must never retain Vite's default
    // four-hour cache lifetime through the public tunnel.
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [
    tailwindcss(),
    !process.env.VITEST && reactRouter(),
    tsconfigPaths(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './build',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    watch: {
      clearScreen: false,
    },
  },
  // test: {
  //   watch: false,
  //   globals: true,
  //   environment: 'jsdom',
  //   include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  //   reporters: ['default'],
  //   coverage: {
  //     reportsDirectory: './test-output/vitest/coverage',
  //     provider: 'v8' as const,
  //   },
  // },
});
