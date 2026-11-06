import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TODO (agente de front): adicionar vite-plugin-pwa (manifest + service worker).
export default defineConfig({
  plugins: [react()],
});
