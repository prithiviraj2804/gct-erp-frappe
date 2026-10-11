import { trustMetaLine } from '@/lib/branding'
import type { TrustBrand } from '@/types/branding'
import { firstNameOf, formatToday, greetingFor } from '@/shell/home/lib/greeting'

/**
 * The dashboard's masthead: who is here, whose system it is, and what day it is.
 *
 * The greeting names the person (first name only — this is a hello, not a record); the line under
 * it names the institution, its type and place, and today's date. The institution mark repeats
 * the topbar's on purpose: arriving on home, "whose data is this?" is the first thing the eye
 * should land on, which is the whole point of a multi-tenant system's home.
 */
export function WelcomeHeader({
  fullName,
  brand,
}: {
  fullName: string | null
  brand: TrustBrand | null
}) {
  const now = new Date()
  const first = firstNameOf(fullName)
  const greeting = first ? `${greetingFor(now)}, ${first}` : greetingFor(now)
  const detail = [trustMetaLine(brand), formatToday(now)].filter(Boolean).join(' · ')

  return (
    // The 64px mark is gone. The institution is already named in the topbar on every screen and
    // again in the line directly below this greeting; a third statement of it, at the largest
    // size on the page, pushed the first clickable thing 314px down. Home opens on your work now.
    <header>
      <div className="min-w-0">
        {/* text-2xl, the ONE page-title step, shared with PageHeader and the module overview.
            It was text-xl — a step below every other page in the app, so the greeting read as a
            subheading of nothing. `leading-tight` and the hand-written tracking go with it: the
            scale sets a line height per step now, and negative tracking at 20px costs legibility
            for a tightening nobody can see. */}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {greeting}
        </h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {brand?.name && <span className="font-medium text-foreground">{brand.name}</span>}
          {brand?.name && detail && ' · '}
          {detail}
        </p>
      </div>
    </header>
  )
}
