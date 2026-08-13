import { call } from '@/shared/lib/frappe'
import type { Session, SessionResponse } from '@/shared/types/auth'

export const sessionKeys = {
  current: () => ['session'] as const,
}

/**
 * Uses our own `erp.api.session.get_session` rather than the SDK's `auth.getLoggedInUser()`.
 *
 * That SDK method calls `frappe.auth.get_logged_user`, which is whitelisted WITHOUT
 * allow_guest — so an anonymous caller gets a 403. That would make "logged out" an error:
 * React Query would retry it, the browser would log it to the console, and it still would
 * not tell us the user's full name. Ours returns 200 with user === "Guest".
 */
export async function fetchSession(): Promise<Session> {
  const res = await call.get<{ message: SessionResponse }>('erp.api.session.get_session')
  const data = res.message

  if (!data || data.user === 'Guest') return { status: 'anonymous' }

  return {
    status: 'authenticated',
    user: data.user,
    fullName: data.full_name ?? data.user,
    roles: data.roles ?? [],
  }
}
