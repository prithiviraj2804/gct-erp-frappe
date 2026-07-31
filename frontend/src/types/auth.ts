/** A Module Def row from this app, as `erp.api.modules.get_allowed_modules` returns it. */
export interface ErpModule {
  /** Module Def primary key, e.g. "Gate". */
  name: string
  module_name: string
}

/** What `erp.api.session.get_session` returns. Always HTTP 200. */
export interface SessionResponse {
  user: string
  full_name: string | null
  roles: string[]
}

/**
 * Client-side session state. A discriminated union so callers must handle both cases —
 * "logged out" is an ordinary answer here, not an error to catch.
 */
export type Session =
  | { status: 'authenticated'; user: string; fullName: string; roles: string[] }
  | { status: 'anonymous' }

/**
 * Result of a login attempt.
 *
 * `otp-required` exists because a 2FA-enabled login returns HTTP **200** carrying `tmp_id`
 * and `verification`, with no "Logged In" message. Without modelling it, useMutation counts
 * that as success, navigates, the guard bounces straight back, and the form appears to have
 * silently done nothing. We don't implement the OTP step yet — but we refuse to mistake it
 * for success.
 */
export type LoginOutcome =
  | { status: 'logged-in'; fullName?: string }
  | { status: 'otp-required'; tmpId: string }
