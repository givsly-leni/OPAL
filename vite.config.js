import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Use deterministic file names without hashes to avoid 404s from outdated index.html
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: (assetInfo) => {
          if (/\.css$/i.test(assetInfo.name || '')) return 'assets/index.css';
          return 'assets/[name][extname]';
        }
      }
    }
  }
});
