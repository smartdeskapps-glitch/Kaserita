import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        inicio: resolve(__dirname, 'index.html'),
        pos: resolve(__dirname, 'pos.html'),
        registro: resolve(__dirname, 'registro.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        terminos: resolve(__dirname, 'terminos.html'),
        reclamos: resolve(__dirname, 'reclamos.html'),
      },
    },
  },
});
