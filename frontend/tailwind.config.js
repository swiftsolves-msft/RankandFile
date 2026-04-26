/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: "#00ff9d",
        cyber: "#00b8ff",
        darkbg: "#0a0a0a",
      }
    }
  }
}