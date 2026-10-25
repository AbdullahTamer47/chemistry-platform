import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,  // Fail clearly if port is taken instead of silently switching
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        // Prevent double /api/api/ prefix
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    },
    hmr: {
      overlay: true  // Show build errors as overlay in the browser
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Split large page bundles for faster initial load
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/pages/admin')) return 'admin';
          if (id.includes('/pages/exams')) return 'exams';
        }
      }
    }
  }
});

