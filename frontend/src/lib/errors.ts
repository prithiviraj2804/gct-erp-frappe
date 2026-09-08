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
  | 'validation' // 417 — the server refused the document and said why
  | 'conflict' // 409 — duplicate, or the document changed underneath you
  | 'missing' // 404 — deleted, renamed, or never existed
  | 'network' // never reached the server
  | 'server' // other 5xx
  | 'unknown'

export interface NormalizedError {
  kind: ErrorKind
  /** Safe to show a user. Never a raw traceback. */
  message: string
  /**
   * Every message the server sent, in order.
   *
   * `frappe.throw` inside a loop — which is how `validate_same_parent` and most controllers
   * report — produces several, and a form that shows only the first sends the user round the
   * loop once per problem. `message` is the first of these when there are any.
   */
  messages: string[]
  httpStatus?: number
  excType?: string
}

export const ERROR_MESSAGES = {
  NETWORK: "Can't reach the server. Check your connection and try again.",
  SERVER: 'Something went wrong on the server. Try again in a moment.',
  UNKNOWN: 'Something went wrong. Try again.',
  PERMISSION: "You don't have permission to do that.",
  RATELIMIT: 'Too many attempts. Wait a moment and try again.',
  VALIDATION: 'The server would not accept this. Check the fields and try again.',
  DUPLICATE: 'A record with that identifier already exists.',
  STALE: 'Someone else changed this record while you were editing. Reload and try again.',
  MISSING: 'That record no longer exists.',
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
 * Frappe's messages arrive as HTML — `frappe.throw(_("<b>{0}</b> is required"))` is legal and
 * common, and `validate_same_parent` emits `<b>` around field names. Rendering that as text
 * shows the tags; rendering it as HTML in React means `dangerouslySetInnerHTML` on a server
 * string. Stripping is the third option and the right one here: the app has no message that
 * needs markup to be understood.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * `_server_messages` is double-encoded: a JSON string containing an array of JSON strings.
 * Anything raised via `frappe.throw()` lands here rather than in `message`, which is why a
 * lockout looks messageless without this — and why, before this existed, every server-side
 * validation in the app surfaced as "There was an error while updating the document".
 *
 * ALL of them are returned, not just the first: a controller that throws once per bad field
 * produces one entry each, and showing one at a time makes the user submit N times to discover
 * N problems.
 *
 * Never lets a malformed payload throw — this runs inside the error path, where a second
 * exception replaces a bad message with no message.
 */
function serverMessages(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const outer: unknown = JSON.parse(raw)
    if (!Array.isArray(outer)) return []

    return outer
      .map((entry) => {
        // Each entry is itself JSON — usually `{"message": "...", "title": "..."}`, sometimes
        // a bare string from older call sites.
        try {
          const inner: unknown = JSON.parse(String(entry))
          if (typeof inner === 'string') return inner
          if (typeof inner === 'object' && inner !== null && 'message' in inner) {
            const message = (inner as { message?: unknown }).message
            return typeof message === 'string' ? message : ''
          }
          return ''
        } catch {
          // Not JSON at all. The raw entry is still the best thing we have.
          return typeof entry === 'string' ? entry : ''
        }
      })
      .map(stripHtml)
      .filter(Boolean)
  } catch {
    return []
  }
}

export function normalizeFrappeError(e: unknown): NormalizedError {
  // The SDK's own unguarded `error.response.data`. Always a connectivity problem.
  if (e instanceof TypeError) {
    return { kind: 'network', message: ERROR_MESSAGES.NETWORK, messages: [] }
  }

  if (isSdkError(e)) {
    const status = e.httpStatus
    const excType = e.exc_type
    const messages = serverMessages(e._server_messages)
    const first = messages[0]

    // Account lockout. Frappe raises SecurityException, which has no `http_status_code`,
    // so frappe/app.py falls back to 500 — it looks like a server error but is a
    // deliberate, user-facing message ("...locked and will resume after N seconds").
    // Without this branch a locked-out user is told "something went wrong".
    // Note this is NOT the 429 path: that only fires if `rate_limit` is set in site_config.
    if (excType === 'SecurityException') {
      return {
        kind: 'locked',
        message: first ?? e.message ?? ERROR_MESSAGES.UNKNOWN,
        messages,
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
        message: e.message ?? first ?? ERROR_MESSAGES.UNKNOWN,
        messages,
        httpStatus: status,
        excType,
      }
    }

    if (status === 403) {
      return {
        kind: 'permission',
        // A PermissionError raised by a controller carries a reason worth showing; one raised
        // by the framework's own check does not, and its text names internals.
        message: first ?? ERROR_MESSAGES.PERMISSION,
        messages,
        httpStatus: status,
        excType,
      }
    }

    if (status === 429) {
      return {
        kind: 'ratelimit',
        message: ERROR_MESSAGES.RATELIMIT,
        messages,
        httpStatus: status,
        excType,
      }
    }

    // 417 is Frappe's ValidationError family — ValidationError, MandatoryError,
    // LinkValidationError, and anything a controller raises through `frappe.throw`. This is the
    // whole reason writes were blocked: the SDK replaces `message` with its own "There was an
    // error while updating the document", and the real explanation is in `_server_messages`.
    // Never fall back to `e.message` here, or that generic string wins over the real one.
    if (status === 417) {
      return {
        kind: 'validation',
        message: first ?? ERROR_MESSAGES.VALIDATION,
        messages,
        httpStatus: status,
        excType,
      }
    }

    // 409 covers two different things and the user acts on them differently: a duplicate
    // identifier is fixed by changing a field, a stale write by reloading first.
    if (status === 409) {
      const stale = excType === 'TimestampMismatchError'
      return {
        kind: 'conflict',
        message: first ?? (stale ? ERROR_MESSAGES.STALE : ERROR_MESSAGES.DUPLICATE),
        messages,
        httpStatus: status,
        excType,
      }
    }

    if (status === 404) {
      return {
        kind: 'missing',
        message: first ?? ERROR_MESSAGES.MISSING,
        messages,
        httpStatus: status,
        excType,
      }
    }

    if (status !== undefined && status >= 500) {
      // Deliberately generic: in developer mode Frappe puts the traceback's last line in
      // `exception`, which must not reach a user.
      return {
        kind: 'server',
        message: ERROR_MESSAGES.SERVER,
        messages,
        httpStatus: status,
        excType,
      }
    }

    return {
      kind: 'unknown',
      message: first ?? e.message ?? ERROR_MESSAGES.UNKNOWN,
      messages,
      httpStatus: status,
      excType,
    }
  }

  if (e instanceof Error) {
    return {
      kind: 'unknown',
      message: e.message || ERROR_MESSAGES.UNKNOWN,
      messages: [],
    }
  }

  return { kind: 'unknown', message: ERROR_MESSAGES.UNKNOWN, messages: [] }
}
