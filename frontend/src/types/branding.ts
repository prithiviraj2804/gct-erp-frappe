/**
 * What `erp.api.branding.get_login_branding` returns. Always HTTP 200, always this shape.
 *
 * Every field is nullable on purpose: this is read by an anonymous visitor before any session
 * exists, and a bench with no Trust record yet is an ordinary state, not an error.
 */

/** The one Trust this site belongs to, reduced to what a signed-out visitor may see. */
export interface TrustBrand {
  /** `trust_name` — the full display name. Never blank. */
  name: string
  /** `short_name`, e.g. "GEI". Doubles as the monogram source when there is no logo. */
  short_name: string | null
  /** `trust_type` — University / Autonomous / Trust / College Group / School Group. */
  type: string | null
  /**
   * Public URL only. The server returns null for a logo stored as a *private* attachment,
   * because a Guest gets a 403 for those and the <img> would render broken.
   */
  logo: string | null
  favicon: string | null
  /** Flattened from the free-form `accreditation` JSON. Capped server-side. Often empty. */
  accreditations: string[]
  /** "City, State", either part optional. */
  location: string | null
  website: string | null
  support_email: string | null
  support_phone: string | null
}

/** How large the institution is. Counts only — the server never sends names. */
export interface TrustScope {
  campuses: number
  institutions: number
}

export interface LoginBranding {
  trust: TrustBrand | null
  scope: TrustScope | null
}
