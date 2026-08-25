import { defineConfig } from 'vite'
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

// In cross-origin deployments (static SPA host + separate API host) the SPA's
// <meta> CSP would block fetches to the API unless connect-src names that
// origin. Inject VITE_API_URL's origin into index.html at build time.
function apiOriginCsp() {
  let apiOrigin = ''
  let mlOrigin = ''
  return {
    name: 'inject-api-origin-csp',
    configResolved(config: { mode: string; root: string }) {
      const env = loadEnv(config.mode, config.root, '')
      try {
        apiOrigin = new URL(env.VITE_API_URL || '').origin
      } catch {
        apiOrigin = ''
      }
      // IES-P0-22b: also allow the Python ML service origin in connect-src so
      // the SPA can call it cross-origin. Falls back to the local dev ML port.
      try {
        mlOrigin = env.VITE_ML_API_URL ? new URL(env.VITE_ML_API_URL).origin : 'http://localhost:8000'
      } catch {
        mlOrigin = 'http://localhost:8000'
      }
    },
    transformIndexHtml(html: string) {
      const out = apiOrigin ? html.replace(/__VITE_API_ORIGIN__/g, apiOrigin) : html
      return out.replace(/__VITE_ML_API_ORIGIN__/g, mlOrigin)
    },
  }
}

export default defineConfig({
  plugins: [react(), requireApiUrl(), apiOriginCsp()],
  test: {
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
  },
})
