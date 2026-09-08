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
      watch: {
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
      allowedHosts: ['frappe.selfmade.chat'],
      proxy: {
        // Everything Frappe owns: REST calls, its own bundled assets, and uploads.
        '^/(api|assets|files|private)': {
          target,
          // Deliberately NOT changeOrigin — that rewrites Host to the target (127.0.0.1:8000)
          // and Frappe then cannot tell which site a request is for. `X-Frappe-Site-Name`
          // covers that for /api, but ONLY for /api: static uploads under /files are served
          // by the werkzeug static handler, which resolves the site from Host alone. With
          // changeOrigin on, every /files request 404s (surfacing as a 500 debug page), so an
          // institution logo silently fell back to its monogram for the whole of development
          // while working in production, where Frappe serves both from one host.
          //
          // Setting Host explicitly fixes both paths: frappe-js-sdk would otherwise send the
          // dev server's own hostname, which resolves to no site at all.
          changeOrigin: false,
          headers: { 'X-Frappe-Site-Name': site, Host: site },
        },
      },
    },
  }
})
