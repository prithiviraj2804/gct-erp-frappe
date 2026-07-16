/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for Frappe API calls. Empty means same-origin. See .env */
  readonly VITE_API_URL?: string
  /** Dev-server proxy target site. Consumed by vite.config.ts, not the browser. */
  readonly VITE_FRAPPE_SITE?: string
  /** Dev-server proxy target origin. Consumed by vite.config.ts, not the browser. */
  readonly VITE_FRAPPE_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
