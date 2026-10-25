import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/** The offline build must not load anything from the network, including the Kakao SDK. */
function stripRemoteScripts(): Plugin {
  return {
    name: 'strip-remote-scripts',
    transformIndexHtml: (html) =>
      html.replace(/\s*<!-- Kakao SDK -->\s*<script src="https:[^"]*"><\/script>/, ''),
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'android' ? [stripRemoteScripts()] : [])],
  // Relative asset paths so the bundle also loads from the Android app's local files.
  base: './',
  resolve: {
    // The AI engine is shared with the server; the offline Android build bundles it.
    alias: {
      '@engine': fileURLToPath(new URL('../backend/src/ai', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    host: true,
    fs: { allow: ['..'] },
  },
}))
