export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  /**
   * The landing screen. Named Home, not Dashboard, because it is not one: it establishes
   * context and launches work, and carries no KPIs, charts or queues — see `pages/home.tsx`.
   */
  HOME: '/home',
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

/**
 * The product's name, used only where there is no institution to name instead — a bench with
 * no Institution record yet. Every other piece of identity on screen comes from that record
 * and is never hardcoded.
 */
export const APP_NAME = 'ERP'
