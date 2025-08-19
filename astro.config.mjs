import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    tailwind()
  ],
  output: 'static', // Keep it static for GitHub Pages
  site: 'https://braincandydan.github.io',
  base: '/i-like-boobs'
});