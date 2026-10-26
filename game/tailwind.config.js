/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        // Soft neon glows used across the app (mint = player, pink = AI).
        'glow-mint': '0 0 10px rgba(94, 234, 212, 0.45), 0 0 24px rgba(94, 234, 212, 0.2)',
        'glow-pink': '0 0 10px rgba(249, 168, 212, 0.45), 0 0 24px rgba(249, 168, 212, 0.2)',
        'glow-sky': '0 0 10px rgba(125, 211, 252, 0.45), 0 0 24px rgba(125, 211, 252, 0.2)',
        'glow-lilac': '0 0 10px rgba(196, 181, 253, 0.45), 0 0 24px rgba(196, 181, 253, 0.2)',
        'glow-lemon': '0 0 10px rgba(253, 230, 138, 0.5), 0 0 26px rgba(253, 230, 138, 0.25)',
        'glow-board': '0 0 18px rgba(167, 139, 250, 0.45), 0 0 48px rgba(94, 234, 212, 0.15)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
