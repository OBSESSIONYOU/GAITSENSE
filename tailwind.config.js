/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F4F4F1',
        primary: '#151715',
        secondary: '#6E726C',
        surface: {
          primary: '#FAFAF8',
          secondary: '#ECEFEB',
        },
        brand: {
          DEFAULT: '#2F806E',
          light: '#DDEAE5',
          dark: '#1F6758',
        },
        status: {
          auth: '#318061',
          tracking: '#AA843B',
          denied: '#B65B5B',
        },
        divider: 'rgba(21, 23, 21, 0.12)',
        operational: '#111311',
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          '"Noto Sans SC"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      maxWidth: {
        'page': '1320px',
      },
      keyframes: {
        slideInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-slide-up': 'fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [],
}
