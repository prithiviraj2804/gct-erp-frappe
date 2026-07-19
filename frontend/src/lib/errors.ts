/**
 * Turns anything thrown by frappe-js-sdk into one predictable shape.
 *
 * This exists because the SDK throws an object literal, not an Error:
 *
 *     throw { ...error.response.data, httpStatus, httpStatusText, message, exception }
 *
 * So `instanceof Error` is false and there is no stack. Worse, it reads
 * `error.response.data` without a guard — when there is no HTTP response at all (offline,
 * DNS failure, CORS block) axios gives an error with no `response`, and the SDK throws a
 * raw TypeError from inside itself. Both have to be handled, plus real Errors and the
 * genuinely unknown.
 */

export type ErrorKind =
  | 'auth' // 401 — bad credentials, or a disabled account
  | 'permission' // 403
  | 'locked' // account lockout. See below: it arrives as a 500.
  | 'ratelimit' // 429
  | 'network' // never reached the server
  | 'server' // other 5xx
  | 'unknown'

export interface NormalizedError {
  kind: ErrorKind
  /** Safe to show a user. Never a raw traceback. */
  message: string
  httpStatus?: number
  excType?: string
}

export const ERROR_MESSAGES = {
  NETWORK: "Can't reach the server. Check your connection and try again.",
  SERVER: 'Something went wrong on the server. Try again in a moment.',
  UNKNOWN: 'Something went wrong. Try again.',
  PERMISSION: "You don't have permission to do that.",
  RATELIMIT: 'Too many attempts. Wait a moment and try again.',
} as const

/** The SDK's thrown-object shape, as far as we rely on it. */
interface SdkErrorShape {
  httpStatus?: number
  httpStatusText?: string
  message?: string
  exception?: string
  exc_type?: string
  _server_messages?: string
}

function isSdkError(e: unknown): e is SdkErrorShape {
  return typeof e === 'object' && e !== null && 'httpStatus' in e
}

/**
 * `_server_messages` is double-encoded: a JSON string containing an array of JSON strings.
 * Anything raised via `frappe.throw()` lands here rather than in `message`, which is why a
 * lockout looks messageless without this. Never let a malformed payload throw — this runs
 * inside the error path.
 */
function firstServerMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const outer: unknown = JSON.parse(raw)
    if (!Array.isArray(outer) || outer.length === 0) return undefined
    const inner: unknown = JSON.parse(String(outer[0]))
    if (typeof inner === 'object' && inner !== null && 'message' in inner) {
      const msg = (inner as { message?: unknown }).message
      return typeof msg === 'string' ? msg : undefined
    }
    return typeof inner === 'string' ? inner : undefined
  } catch {
    return undefined
  }
}

export function normalizeFrappeError(e: unknown): NormalizedError {
  // The SDK's own unguarded `error.response.data`. Always a connectivity problem.
  if (e instanceof TypeError) {
    return { kind: 'network', message: ERROR_MESSAGES.NETWORK }
  }

  if (isSdkError(e)) {
    const status = e.httpStatus
    const excType = e.exc_type
    const serverMessage = firstServerMessage(e._server_messages)

    // Account lockout. Frappe raises SecurityException, which has no `http_status_code`,
    // so frappe/app.py falls back to 500 — it looks like a server error but is a
    // deliberate, user-facing message ("...locked and will resume after N seconds").
    // Without this branch a locked-out user is told "something went wrong".
    // Note this is NOT the 429 path: that only fires if `rate_limit` is set in site_config.
    if (excType === 'SecurityException') {
      return {
        kind: 'locked',
        message: serverMessage ?? e.message ?? ERROR_MESSAGES.UNKNOWN,
        httpStatus: status,
        excType,
      }
    }

    if (status === 401) {
      // Frappe's own wording. Unknown user and wrong password share
      // "Invalid login credentials"; a disabled account says "User disabled or missing".
      // Pass it through rather than guessing which case we're in.
      return {
        kind: 'auth',
        message: e.message ?? serverMessage ?? ERROR_MESSAGES.UNKNOWN,
        httpStatus: status,
        excType,
      }
    }

    if (status === 403) {
      return { kind: 'permission', message: ERROR_MESSAGES.PERMISSION, httpStatus: status, excType }
    }

    if (status === 429) {
      return { kind: 'ratelimit', message: ERROR_MESSAGES.RATELIMIT, httpStatus: status, excType }
    }

    if (status !== undefined && status >= 500) {
      // Deliberately generic: in developer mode Frappe puts the traceback's last line in
      // `exception`, which must not reach a user.
      return { kind: 'server', message: ERROR_MESSAGES.SERVER, httpStatus: status, excType }
    }

    return {
      kind: 'unknown',
      message: e.message ?? ERROR_MESSAGES.UNKNOWN,
      httpStatus: status,
      excType,
    }
  }

  if (e instanceof Error) {
    return { kind: 'unknown', message: e.message || ERROR_MESSAGES.UNKNOWN }
  }

  return { kind: 'unknown', message: ERROR_MESSAGES.UNKNOWN }
}
