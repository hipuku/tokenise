import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The fixtures include a stylesheet imported with ?raw, which vitest
    // otherwise replaces with an empty module.
    css: true,
  },
})
