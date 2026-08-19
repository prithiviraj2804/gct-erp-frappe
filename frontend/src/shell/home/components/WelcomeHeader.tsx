import { InstitutionMark } from '@/shared/components/brand/InstitutionMark'
import { institutionMetaLine } from '@/shared/lib/branding'
import type { InstitutionBrand } from '@/shared/types/branding'
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
  brand: InstitutionBrand | null
}) {
  const now = new Date()
  const first = firstNameOf(fullName)
  const greeting = first ? `${greetingFor(now)}, ${first}` : greetingFor(now)
  const detail = [institutionMetaLine(brand), formatToday(now)].filter(Boolean).join(' · ')

  return (
    <header className="flex items-center gap-4">
      {brand && <InstitutionMark brand={brand} size="lg" className="hidden shrink-0 sm:inline-flex" />}
      <div className="min-w-0">
        <h1 className="font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
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
