import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { brandingKeys, fetchLoginBranding, pageTitle } from '@/lib/branding'
import type { InstitutionBrand } from '@/types/branding'

/**
 * Institution identity for the sign-in screen.
 *
 * `retry: false` is deliberate. Branding is decoration on top of a form that must work
 * without it, so a failure here should cost one request and then get out of the way — never
 * three, and never a delay before the user can type. Callers treat `error` exactly like
 * "no institution": render the product's own mark and move on.
 */
export function useLoginBranding() {
  return useQuery({
    queryKey: brandingKeys.login(),
    queryFn: fetchLoginBranding,
    retry: false,
    // Server-side this is redis-cached for 5 minutes; matching that here means a bounce
    // through /login and back never re-requests it.
    staleTime: 5 * 60_000,
    // Nothing about an institution's logo changes while the user stares at the login form.
    refetchOnWindowFocus: false,
  })
}

/**
 * The same institution payload, read from inside the app.
 *
 * An alias rather than a second query on purpose — it resolves to the identical cache entry,
 * so signing in and landing on the home page reuses what /login already fetched and the
 * institution's name never flashes a skeleton on arrival. The endpoint is `allow_guest`, but
 * that only means an anonymous visitor *may* call it; an authenticated one gets the same
 * answer, and there is no second, richer payload to ask for.
 *
 * Named for the caller's intent so nothing inside the shell has to import "login" branding.
 */
export const useInstitutionBranding = useLoginBranding

/**
 * Points the browser tab at the institution: title, and the favicon when one is configured.
 *
 * The title is restored on unmount so navigating away from /login does not leave "Sign in"
 * in the tab. The favicon deliberately is not — it is app-wide identity, correct on every
 * screen, and this is the only place that learns it.
 */
export function useBrandedDocument(page: string, brand: InstitutionBrand | null | undefined) {
  useEffect(() => {
    const previous = document.title
    document.title = pageTitle(page, brand ?? null)

    return () => {
      document.title = previous
    }
  }, [page, brand])

  useEffect(() => {
    if (!brand?.favicon) return

    // index.html ships `<link rel="icon" type="image/svg+xml">`. Reusing that node rather than
    // appending keeps the `type` from lying about a PNG upload, so it is cleared.
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return

    const previousHref = link.href
    const previousType = link.type
    link.type = ''
    link.href = brand.favicon

    return () => {
      link.href = previousHref
      link.type = previousType
    }
  }, [brand?.favicon])
}
