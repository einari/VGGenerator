import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.PORT || '8787'

  return {
    plugins: [react()],
    server: {
      // Forward /api to the Node backend, which talks to the LLM and writes
      // articles to disk. Same origin from the browser -> no CORS, no key here.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
