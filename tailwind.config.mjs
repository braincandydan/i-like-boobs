/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    './public/**/*.html'
  ],
  theme: {
    extend: {
      colors: {
        'netflix-red': '#e50914',
        'netflix-black': '#141414',
        'netflix-gray': '#333333'
      },
      fontFamily: {
        'sans': ['Helvetica Neue', 'Arial', 'sans-serif']
      }
    },
  },
  plugins: [],
}
