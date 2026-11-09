import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' so the built site works from any sub-folder (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        stage: resolve(import.meta.dirname, 'stage.html'),
      },
    },
  },
});
