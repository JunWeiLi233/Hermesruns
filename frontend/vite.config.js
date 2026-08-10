import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/src/main/resources/static',
    // Important: backend/static/assets is served directly by Spring. The
    // publish script intentionally retains immutable hashed chunks so tabs
    // with an older index.html do not request deleted CSS/JS files.
    emptyOutDir: false,
    // Generate readable-ish bundles when `VITE_MINIFY=false`.
    // Note: bundles are still output as JS modules; original code lives in `frontend/` or devtools via sourcemaps.
    minify: process.env.VITE_MINIFY === 'false' ? false : 'esbuild',
    cssMinify: process.env.VITE_CSS_MINIFY === 'false' ? false : true,
    sourcemap: process.env.VITE_SOURCEMAP === 'false' ? false : true,
  },
})
