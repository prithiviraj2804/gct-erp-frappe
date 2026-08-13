import { FrappeApp } from 'frappe-js-sdk'

declare global {
  interface Window {
    csrf_token?: string
  }
}

// Empty (the default, see .env) keeps every request same-origin: in production Frappe
// serves the app itself, and in development the Vite proxy forwards /api to the bench.
//
// An absolute URL here breaks cookie auth outright and cannot be worked around: Frappe
// sets `sid` SameSite=Lax and only adds Secure over https, so the browser will not attach
// it to a cross-site request. `.trim() ||` (not `??`) so a blank or whitespace value
// falls back to same-origin instead of silently going cross-origin.
const frappe = new FrappeApp(import.meta.env.VITE_API_URL?.trim() || '')

export const db = frappe.db()
export const call = frappe.call()
export const auth = frappe.auth()
export const file = frappe.file()
