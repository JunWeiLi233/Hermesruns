import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const { defineConfig } = await import(pathToFileURL(require.resolve('vite')).href);
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root, base: './', plugins: [react()],
  resolve: {
    alias: ['react', 'react-dom', 'react-router', 'lucide-react', 'leaflet', '@testing-library/react', '@testing-library/user-event', '@testing-library/jest-dom', 'vitest'].map(name => ({ find: name, replacement: path.resolve(root, '../../../frontend/node_modules', name) })),
    dedupe: ['react', 'react-dom'],
  },
  server: { host: '127.0.0.1', port: 4326, strictPort: true, proxy: {'/api/explorer':{target:process.env.EXPLORER_API_TARGET||'http://127.0.0.1:8080',changeOrigin:false}}, fs: { allow: [path.resolve(root, '../../..')] } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{js,jsx}'], globals: true, setupFiles: ['./tests/setup.js'] },
});
