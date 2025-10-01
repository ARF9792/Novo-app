/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        bolt: {
          primary: "#0b5cff",
          accent: "#ff7a00",
        },
      },
    },
  },
  plugins: [],
};