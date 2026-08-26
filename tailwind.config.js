/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#090B10',
          surface: '#11141D',
          card: '#161B27',
          panel: 'rgba(22, 27, 39, 0.75)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-bright': 'rgba(255, 255, 255, 0.18)',
          cream: '#FDF8EE',
          'cream-muted': '#B8B09F',
          amber: '#FFB224',
          'amber-dim': '#C4820F',
          crimson: '#FF3366',
          'crimson-dim': '#B81A43',
          mint: '#00F5A0',
          'mint-dim': '#0C9F6B',
          cyan: '#00E5FF',
          'cyan-dim': '#0897AA',
          violet: '#9D4EDD',
          'violet-dim': '#6E2DA8',
        }
      },
      fontFamily: {
        arcade: ['"Press Start 2P"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 25px -5px rgba(255, 178, 36, 0.4)',
        'glow-crimson': '0 0 25px -5px rgba(255, 51, 102, 0.4)',
        'glow-mint': '0 0 25px -5px rgba(0, 245, 160, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(0, 229, 255, 0.4)',
        'glow-violet': '0 0 25px -5px rgba(157, 78, 221, 0.4)',
        'glass-edge': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.88' },
        }
      }
    },
  },
  plugins: [],
}
