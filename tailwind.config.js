/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        clover: {
          50: "#f7f8f3",
          100: "#e8efe8",
          200: "#d1ddd2",
          300: "#adc3b3",
          400: "#789a82",
          500: "#4e765e",
          600: "#173f32",
          700: "#12372a",
          800: "#0f2d23",
          900: "#0a2119",
        },
      },
    },
  },
  plugins: [],
};
