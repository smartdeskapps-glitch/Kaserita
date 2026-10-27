import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.js"],
    environment: "node",
  },
  build: {
    rolldownOptions: {
      // React y Supabase casi nunca cambian: en archivos aparte, un despliegue
      // de la app no obliga a descargarlos de nuevo.
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
      input: {
        inicio: resolve(__dirname, 'index.html'),
        pos: resolve(__dirname, 'pos.html'),
        registro: resolve(__dirname, 'registro.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        terminos: resolve(__dirname, 'terminos.html'),
        terminosDelivery: resolve(__dirname, 'terminos-delivery.html'),
        reclamos: resolve(__dirname, 'reclamos.html'),
      },
    },
  },
});
