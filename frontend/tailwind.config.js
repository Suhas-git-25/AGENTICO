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
        brand: {
          50: '#E8F8EE',
          100: '#D4F4E2',
          200: '#A9E8C5',
          300: '#7DDCAB',
          400: '#3EC983',
          500: '#00A859',
          600: '#00924D',
          700: '#007A41',
          800: '#006234',
          900: '#004A27',
        },
        surface: {
          light: '#F3F4F6',
          muted: '#F9FAFB',
          border: '#E5E7EB',
        },
        schedule: {
          bg: '#FEF3E8',
          text: '#E66E00',
          border: '#FCDDC2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
