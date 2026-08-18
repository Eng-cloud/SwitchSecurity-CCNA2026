import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const SINGLE_FILE = process.env.SINGLE_FILE === '1';

export default defineConfig({
  plugins: [react()],
  // نسخة الملف الواحد: كل شيء مضمّن، بلا تقسيم حزم ولا أصول خارجية.
  build: SINGLE_FILE
    ? {
        outDir: 'dist-single',
        cssCodeSplit: false,
        assetsInlineLimit: 100_000_000,
        modulePreload: { polyfill: false },
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
