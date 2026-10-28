/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './registro.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      // Pisa las escalas "orange" y "violet" de Tailwind con la paleta Crocus Purple /
      // Ebony Clay / Titan White: todo lo que usa clases orange-* o violet-* (botones,
      // precios, pestañas activas, etc.) cambia de color sin tocar cada pantalla.
      // 600 es el tono de acciones (el blanco se lee bien encima); 400 es el Crocus puro.
      colors: {
        orange: {
          50: '#f3f5ff',
          100: '#ebf0ff',
          200: '#dde4fa',
          300: '#c5bcff',
          400: '#9687f5',
          500: '#7466e8',
          600: '#5b4bd6',
          700: '#473bb5',
          800: '#3b3466',
          900: '#2d284b',
          950: '#221e3d',
        },
        violet: {
          50: '#f3f5ff',
          100: '#ebf0ff',
          200: '#dde4fa',
          300: '#c5bcff',
          400: '#9687f5',
          500: '#7466e8',
          600: '#5b4bd6',
          700: '#473bb5',
          800: '#3b3466',
          900: '#2d284b',
          950: '#221e3d',
        },
      },
    },
  },
  plugins: [],
};
