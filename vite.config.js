import { defineConfig } from 'vite';

// base './' so the built site works from any sub-folder (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
