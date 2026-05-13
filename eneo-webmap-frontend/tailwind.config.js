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
        // ── Palette SIMS Online (plateforme) ──
        sims: {
          950: '#070e17',
          900: '#0D1B2A',  // header / navbar
          800: '#132337',  // sidebar
          700: '#1A2E45',  // fond carte
          600: '#1e3a5f',
          500: '#2a4d74',
          400: '#3b6494',
        },
        // ── Cyan accent SIMS ──
        cyan: {
          400: '#29BBE8',
          500: '#00AADD',  // accent principal
          600: '#0095C4',
          700: '#007AA3',
        },
        // ── Palette ENEO (App 1) ──
        eneo: {
          50:  '#fff8e1',
          100: '#ffecb3',
          200: '#ffe082',
          300: '#ffd54f',
          400: '#ffca28',
          500: '#ffc107',  // Jaune ENEO
          600: '#ffb300',
          700: '#ffa000',
          800: '#ff8f00',
          900: '#ff6f00',
        },
        // ── Danger / alertes ──
        danger: '#FF4757',
        // ── Aliases utilitaires ──
        brand: {
          dark:  '#0D1B2A',
          light: '#132337',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        mono:  ['Fira Code', 'Courier New', 'monospace'],
      },
      backgroundImage: {
        'sims-gradient': 'linear-gradient(160deg, #070e17 0%, #0D1B2A 40%, #0f1e30 100%)',
        'card-gradient': 'linear-gradient(135deg, #0a1a2e 0%, #0d1b2a 50%, #112030 100%)',
      },
      boxShadow: {
        'cyan-sm': '0 2px 8px rgba(0,170,221,0.15)',
        'cyan-md': '0 4px 20px rgba(0,170,221,0.2)',
        'cyan-lg': '0 8px 40px rgba(0,170,221,0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
