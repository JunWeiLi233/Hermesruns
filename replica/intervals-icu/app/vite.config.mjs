import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const {
  defineConfig
} = await import(pathToFileURL(require.resolve('vite')).href);
const {
  default: react
} = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: ['react', 'react-dom', 'react-router', 'lucide-react', 'vitest', '@testing-library/react', '@testing-library/jest-dom', '@testing-library/user-event'].map(name => ({
      find: name,
      replacement: path.resolve(root, '../../../frontend/node_modules', name)
    })),
    dedupe: ['react', 'react-dom']
  },
  server: {
    host: '127.0.0.1',
    port: 4318,
    strictPort: true,
    proxy: { "/api": {target: process.env.TRAINING_BACKEND_URL || "http://127.0.0.1:8091", changeOrigin: false} },
    fs: {
      allow: [path.resolve(root, '../../..')]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{mjs,jsx}'],
    globals: true
  }
});
