/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './registro.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      // Pisa la escala "orange" de Tailwind con un violeta anclado
      // exactamente en el mismo #7c3aed (violet-600) que ya se usa en
      // el degradado del login y en los badges del encabezado -- así
      // TODO lo que en el código sigue usando clases orange-50..950
      // (botones, precios, pestañas activas, etc.) cambia de color
      // automáticamente, sin tener que tocar cada pantalla a mano.
      colors: {
        orange: {
          50: '#f5f0ff',
          100: '#ece1fe',
          200: '#d6c2fa',
          300: '#ba97f7',
          400: '#9b69f2',
          500: '#925bf0',
          600: '#7c3aed',
          700: '#6217e2',
          800: '#5416bf',
          900: '#4915a2',
          950: '#350f75',
        },
      },
    },
  },
  plugins: [],
};
