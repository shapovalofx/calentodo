/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e11d48', // red-600
          light: '#fb7185', // rose-400
          dark: '#9f1239' // rose-800
        }
      },
      fontFamily: {
        sans: ['system-ui', 'BlinkMacSystemFont', '-apple-system', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};

