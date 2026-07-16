import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // The config runs in Node, so import.meta.env isn't available here — read .env directly.
  const env = loadEnv(mode, __dirname, '')

  const site = env.VITE_FRAPPE_SITE || 'erp.localhost'
  const target = env.VITE_FRAPPE_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss()
    ],

    // Frappe serves the built app out of /assets/erp/dist/, but the dev server
    // serves from the root — otherwise this prefix collides with the /assets proxy.
    base: command === 'build' ? '/assets/erp/dist/' : '/',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    build: {
      outDir: '../erp/public/dist',
      emptyOutDir: true,
      assetsDir: 'assets',
    },

    server: {
      proxy: {
        // Everything Frappe owns: REST calls, its own bundled assets, and uploads.
        '^/(api|assets|files|private)': {
          target,
          changeOrigin: true,
          // frappe-js-sdk sends X-Frappe-Site-Name from window.location.hostname, which is
          // "localhost" on the dev server — Frappe would resolve that to a nonexistent site.
          headers: { 'X-Frappe-Site-Name': site },
        },
      },
    },
  }
})
