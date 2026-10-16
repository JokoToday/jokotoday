import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api/assistant": { target: "http://127.0.0.1:3101" } } },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['html5-qrcode'],
  },
});
