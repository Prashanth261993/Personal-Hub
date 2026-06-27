// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages: served from https://prashanth261993.github.io/Personal-Hub/
export default defineConfig({
  site: 'https://prashanth261993.github.io',
  base: '/Personal-Hub',
  vite: {
    plugins: [tailwindcss()],
  },
});
