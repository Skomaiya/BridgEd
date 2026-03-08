/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bridged: {
          primary: '#0B1F33',
          teal: '#1F7A8C',
          light: '#F8F9FA',
          accent: '#F4B400',
        },
      },
    },
  },
  plugins: [],
};
