import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// IES-P0-22: fail the production build loudly when VITE_API_URL is missing —
// the client must never ship with a silent localhost fallback.
function requireApiUrl() {
  return {
    name: 'require-vite-api-url',
    configResolved(config: { command: string; mode: string; root: string }) {
      if (config.command !== 'build') return
      const env = loadEnv(config.mode, config.root, '')
      if (!env.VITE_API_URL) {
        throw new Error(
          'VITE_API_URL is required. Create mainApp/.env with e.g. VITE_API_URL=http://localhost:5001/api'
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), requireApiUrl()],
  test: {
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
  },
})
