/**  @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aqi-good': '#00e400',
        'aqi-moderate': '#ffff00',
        'aqi-unhealthy-sensitive': '#ff7e00',
        'aqi-unhealthy': '#ff0000',
        'aqi-very-unhealthy': '#8f3f97',
        'aqi-hazardous': '#7e0023',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}