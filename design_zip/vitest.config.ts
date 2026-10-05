import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts so the Figma Make plugins are not loaded under test.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true, // lets Testing Library auto-clean the DOM between tests
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    pool: 'threads',
  },
})
