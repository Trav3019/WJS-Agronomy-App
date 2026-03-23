/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        farm: {
          green: '#2d6a4f',
          'green-light': '#52b788',
          'green-dark': '#1b4332',
          gold: '#d4a017',
          brown: '#6b4226',
          sky: '#3a86ff',
          earth: '#8b5e3c',
        }
      }
    },
  },
  plugins: [],
}

