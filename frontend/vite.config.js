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
    // Source maps are debug-only because backend/static is served publicly.
    minify: process.env.VITE_MINIFY === 'false' ? false : 'esbuild',
    cssMinify: process.env.VITE_CSS_MINIFY === 'false' ? false : true,
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    rolldownOptions: {
      output: {
        // Keep the app entry focused on bootstrap code. Locale payloads are
        // large, stable across route releases, and cache independently.
        codeSplitting: {
          groups: [
            {
              name: 'framework',
              test: /node_modules[\\/](?:react|react-dom|react-router|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'i18n-en',
              test: /src[\\/]i18n[\\/]locales[\\/]en[\\/]/,
              priority: 20,
            },
            {
              name: 'i18n-zh-CN',
              test: /src[\\/]i18n[\\/]locales[\\/]zh-CN[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
})
