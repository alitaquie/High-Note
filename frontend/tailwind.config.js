/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html", // optional but good practice
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7c3aed',   // purple-600
        secondary: '#6366f1', // indigo-500
        neonPink: '#ec4899',
        softWhite: '#f3f4f6',
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        float: 'float 3s ease-in-out infinite',
        pulseFast: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 10px rgba(255, 255, 255, 0.2)',
      },
      theme: {
        extend: {
          animation: {
            bounce: 'bounce 1.5s infinite',
          },
        },
      }, 
      extend: {
        animation: {
          'fade-in': 'fadeIn 1s ease-out both',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: 0, transform: 'translateY(20px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
        },
      }
      
      
    },
  },
  plugins: [],
}
