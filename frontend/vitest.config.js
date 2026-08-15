import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.vitest.{js,jsx,ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
  },
});
