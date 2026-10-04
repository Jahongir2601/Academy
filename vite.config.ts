import { defineConfig } from 'vite';

// Nisbiy yo‘llar: dist/ papkasini istalgan statik hostingga (GitHub Pages va h.k.) qo‘yish mumkin.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
  },
});
