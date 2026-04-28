import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cast plugins to any to bridge the vite@6 (used by app) vs vite@5
// (transitively pulled in by vitest@2) plugin-type mismatch — same
// constraint that motivated splitting vitest/vite configs in a7b6dda.
export default defineConfig({
  plugins: [react(), tailwindcss()] as never,
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
