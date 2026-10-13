/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { suggestApiPlugin } from './server/vitePlugin.js'

const DEFAULT_PORT = 3020

export default defineConfig(({ mode }) => {
  // Empty prefix: the server route needs OPENROUTER_* too. None of it reaches the client bundle,
  // because only variables passed through `define` or prefixed with VITE_ are exposed there.
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT) || DEFAULT_PORT

  return {
    plugins: [react(), suggestApiPlugin(env)],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    test: {
      include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }
})