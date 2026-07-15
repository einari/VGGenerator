import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy browser -> local LLM so the in-browser "Generer nyheter" button can
    // reach the OpenAI-compatible server without hitting CORS.
    // The app calls /llm/v1/... and it is forwarded to 127.0.0.1:8000/v1/...
    proxy: {
      '/llm': {
        target: process.env.LLM_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/llm/, ''),
      },
    },
  },
})
