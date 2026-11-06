import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createProgressMiddleware } from './src/server/progressMiddleware.ts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-progress-disk-persistence',
      configureServer(server) {
        server.middlewares.use(createProgressMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createProgressMiddleware());
      },
    },
  ],
});
