export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
} as const

/**
 * The URL path the SPA is MOUNTED at.
 *
 * Deliberately NOT `import.meta.env.BASE_URL`. That is the *asset* prefix — vite.config.ts
 * sets `base: '/assets/erp/dist/'` for builds, because that is where Frappe serves the JS
 * and CSS from. But the *page* is served at /erp by `website_route_rules` in hooks.py.
 * Two different paths; using BASE_URL here would 404 every route.
 */
export const ROUTER_BASENAME = import.meta.env.PROD ? '/erp' : '/'

export const APP_NAME = 'ERP'
