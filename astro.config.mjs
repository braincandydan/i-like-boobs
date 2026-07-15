import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    sitemap()
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  output: 'static', // Keep it static for GitHub Pages
  site: 'https://braincandydan.github.io',
  base: '/i-like-boobs'
});