import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

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
    manifest: 'public-page-assets.json',
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
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        public: fileURLToPath(new URL('./public.html', import.meta.url)),
      },
      output: {
        // Locale groups leave shared public modules outside their bucket.
        // Preserve module evaluation order across the resulting shared chunks.
        strictExecutionOrder: true,
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
              test: /src[\\/]i18n[\\/]locales[\\/]en[\\/](?!(?:landing|publicLanding)\.js)/,
              // Shared public copy must not be swept into the private bucket
              // merely because the full dictionary imports it.
              includeDependenciesRecursively: false,
              priority: 20,
            },
            {
              name: 'i18n-zh-CN',
              test: /src[\\/]i18n[\\/]locales[\\/]zh-CN[\\/](?!(?:landing|publicLanding)\.js)/,
              includeDependenciesRecursively: false,
              priority: 20,
            },
          ],
        },
      },
    },
  },
})
