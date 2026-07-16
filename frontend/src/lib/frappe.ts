import { FrappeApp } from 'frappe-js-sdk'

declare global {
  interface Window {
    csrf_token?: string
  }
}

// Empty (the default, see .env) keeps every request same-origin: in production Frappe
// serves the app itself, and in development the Vite proxy forwards /api to the bench.
const frappe = new FrappeApp(import.meta.env.VITE_API_URL ?? '')

export const db = frappe.db()
export const call = frappe.call()
export const auth = frappe.auth()
export const file = frappe.file()
