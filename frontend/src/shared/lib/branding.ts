import { call } from '@/shared/lib/frappe'
import { APP_NAME } from '@/shared/lib/constants'
import type { InstitutionBrand, InstitutionScope, LoginBranding } from '@/shared/types/branding'

export const brandingKeys = {
  login: () => ['branding', 'login'] as const,
}

/** Rendered when the bench has no Institution record yet — the product's own identity. */
export const FALLBACK_MONOGRAM = 'E'

export async function fetchLoginBranding(): Promise<LoginBranding> {
  const res = await call.get<{ message: LoginBranding }>('erp.api.branding.get_login_branding')

  // A malformed or empty envelope is treated as "no institution", not as a failure. The
  // sign-in form has to render either way, and unbranded is a designed state.
  return {
    institution: res.message?.institution ?? null,
    scope: res.message?.scope ?? null,
  }
}

/**
 * Words that carry no identity, so they never contribute a monogram letter. "Gnyanamani
 * Educational Institutions" should read GEI, not GEI-plus-noise; "Board of Higher Education"
 * should read BHE, not BOHE.
 */
const MONOGRAM_STOP_WORDS = new Set([
  'of',
  'and',
  'the',
  'for',
  'a',
  'an',
  'group',
  'trust',
  'society',
  'institutions',
  'institution',
])

/**
 * The letters shown when an institution has no logo — which is the common case, since `logo`
 * is optional and the server withholds private attachments.
 *
 * `short_name` wins when it is already monogram-shaped (≤4 characters, as codes like "GEI" or
 * "SRMV" are). Otherwise the initials of up to three identity-bearing words. Never returns
 * empty: an empty monogram tile is the one outcome that looks broken.
 */
export function monogramFor(brand: InstitutionBrand | null): string {
  if (!brand) return FALLBACK_MONOGRAM

  const short = brand.short_name?.trim() ?? ''
  if (short && short.length <= 4) return short.toUpperCase()

  const initials = brand.name
    .split(/[\s\-–—/,.]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0 && !MONOGRAM_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3)
    // Spread, not [0]: charAt would split a surrogate pair and render a replacement glyph.
    .map((word) => [...word][0])
    .join('')

  return (initials || [...brand.name.trim()][0] || FALLBACK_MONOGRAM).toUpperCase()
}

/** The line under the institution name: "Trust · Namakkal, Tamil Nadu", either half optional. */
export function institutionMetaLine(brand: InstitutionBrand | null): string | null {
  if (!brand) return null
  return [brand.type, brand.location].filter(Boolean).join(' · ') || null
}

export interface ScopeStat {
  key: keyof InstitutionScope
  label: string
  value: number
}

/** Hierarchy order — Institution → Campus → College → Department → Programme. */
const SCOPE_LABELS: {
  key: keyof InstitutionScope
  one: string
  many: string
}[] = [
  { key: 'campuses', one: 'Campus', many: 'Campuses' },
  { key: 'colleges', one: 'College', many: 'Colleges' },
  { key: 'departments', one: 'Department', many: 'Departments' },
  { key: 'programmes', one: 'Programme', many: 'Programmes' },
]

/**
 * The scope strip's entries, with zeros dropped.
 *
 * A brand-new bench has one College and no Campuses; rendering "0 Campuses" is honest but
 * reads as an unfinished setup rather than an institution's scale. Omitting the empty ones
 * keeps the strip truthful and still structured.
 */
export function scopeStats(scope: InstitutionScope | null): ScopeStat[] {
  if (!scope) return []

  return SCOPE_LABELS.filter(({ key }) => scope[key] > 0).map(({ key, one, many }) => ({
    key,
    label: scope[key] === 1 ? one : many,
    value: scope[key],
  }))
}

/** Browser tab text. Page purpose first, per WCAG 2.4.2 — the tail is truncated in a narrow tab. */
export function pageTitle(page: string, brand: InstitutionBrand | null): string {
  return `${page} · ${brand?.short_name || brand?.name || APP_NAME}`
}
