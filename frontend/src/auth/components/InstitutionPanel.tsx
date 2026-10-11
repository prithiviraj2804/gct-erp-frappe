import { InstitutionMark } from '@/components/brand/InstitutionMark'
import { scopeStats, trustMetaLine } from '@/lib/branding'
import { APP_NAME } from '@/lib/constants'
import type { TrustBrand, TrustScope } from '@/types/branding'

/**
 * The identity half of the sign-in screen: who this bench belongs to, drawn from the
 * Institution record rather than hardcoded.
 *
 * Why a second panel at all, when the ui skill rules out hero sections: this is not a hero.
 * It is the multi-tenant answer to "whose ERP am I about to sign into?", which for a group
 * running several colleges is a real question and the single most useful thing a sign-in
 * screen can state. It carries identity, accreditation and scale — facts — and no imagery,
 * no marketing copy and no call to action.
 *
 * Hidden below `lg`. On small screens the same identity is restated compactly above the form,
 * so nothing here is the only place a fact appears.
 */
export function InstitutionPanel({
  brand,
  scope,
  isPending,
}: {
  brand: TrustBrand | null
  scope: TrustScope | null
  isPending: boolean
}) {
  const meta = trustMetaLine(brand)
  const stats = scopeStats(scope)

  // The fill is `--brand-panel`, and this is the ONE surface in the app that stays deep in both
  // themes. It used to ride `--sidebar-deep`, which was the same value while the chrome was ink
  // — but the chrome is light in light mode now, and this panel following it there would have
  // rendered a #E1E5EB slab beside a white form column: 1.09:1, an almost uniform white
  // rectangle with a monogram floating in it.
  //
  // The distinction is real rather than a workaround. This is not chrome, it is a hero: it is
  // 62% of the first screen anyone ever sees, and identity is its entire job. A product with a
  // light app can still have a deep sign-in, and most do.
  //
  // Deep ink rather than a saturated blue, for a reason specific to a multi-tenant product: it
  // sits directly beside an ARBITRARY tenant's crest, and a committed mid-blue fights a maroon
  // or a green one. Ink flatters all of them, and lets the institution's own mark be the
  // brightest object on the panel — which is the entire point of the sign-in screen.
  //
  // Two textures were tried here and removed, both on the evidence of a screenshot: a
  // hairline grid, which rendered as a spreadsheet lattice, and a vertical black wash, which
  // banded visibly — an 8-bit gradient over a near-black navy has very few steps to work
  // with. Flat is what the design system specifies and the only one of the three that renders
  // cleanly at this size.
  return (
    <aside className="hidden bg-brand-panel p-10 text-brand-panel-foreground lg:flex xl:p-14">
      {/* One measure for both zones, centred in the panel. Without the cap the heading would
          run to whatever width the viewport allows; without the centring the whole column hugs
          the left edge and a 1376px-wide panel on a 1920 monitor reads as mostly empty navy.
          `max-w-xl` also keeps the four-column scope strip on one row. */}
      <div className="mx-auto flex w-full max-w-xl flex-col">
        {/* No product mark and no product name. The only identity on this screen belongs to
            the institution, which means the panel opens directly on it. */}

        {/* Identity and scale are one block, not two. Splitting them across a `justify-between`
            column left the counts stranded at the foot of the panel, reading as unrelated
            chrome rather than as facts about the institution named above them. */}
        <div className="flex flex-1 flex-col justify-center py-12">
          {isPending ? <IdentitySkeleton /> : <Identity brand={brand} meta={meta} />}

          {stats.length > 0 && (
            // <div> inside <dl> is valid, and is what lets each term/definition pair share a
            // divider cell.
            <dl className="mt-10 flex flex-wrap divide-x divide-brand-panel-border border-t border-brand-panel-border pt-6">
              {stats.map((stat) => (
                <div key={stat.key} className="px-6 first:pl-0">
                  <dt className="text-2xs font-medium tracking-eyebrow text-brand-panel-muted uppercase">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {brand?.website && (
          <a
            href={normalizeUrl(brand.website)}
            target="_blank"
            rel="noreferrer noopener"
            className="self-start rounded-sm text-xs text-brand-panel-muted underline-offset-4 hover:text-brand-panel-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-panel-mark"
          >
            {displayUrl(brand.website)}
          </a>
        )}
      </div>
    </aside>
  )
}

function Identity({ brand, meta }: { brand: TrustBrand | null; meta: string | null }) {
  return (
    // Fades in only once the name is known, so the panel doesn't flash placeholder text.
    // motion-safe keeps it out of the way for prefers-reduced-motion.
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {/* surface="brand": on the deep panel the monogram is a light plate carrying the brand
          glyph, which is what makes the institution's mark the brightest object here — the
          stated point of the whole screen. A tenant with a real logo still gets their logo. */}
      <InstitutionMark brand={brand} size="lg" surface="brand" />

      {/* APP_NAME only as a last resort — a bench with no Institution record has no
          institution to name, and a headless panel would read as a broken page. */}
      <h2 className="mt-7 font-heading text-3xl leading-[1.15] font-bold tracking-tight text-balance xl:text-4xl">
        {brand?.name ?? APP_NAME}
      </h2>

      <p className="mt-3 text-sm text-brand-panel-muted">
        {meta ?? 'Sign in to the institution management system.'}
      </p>

      {brand && brand.accreditations.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {brand.accreditations.map((item) => (
            <li
              key={item}
              className="rounded-md border border-brand-panel-border bg-brand-panel-raised px-2.5 py-1 text-xs font-medium text-brand-panel-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Same footprint as `Identity`, so resolving the request doesn't shift the panel. */
function IdentitySkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="size-16 rounded-xl bg-brand-panel-raised" />
      <div className="mt-7 h-9 w-80 max-w-full rounded-md bg-brand-panel-raised" />
      <div className="mt-3 h-4 w-52 max-w-full rounded bg-brand-panel-raised" />
    </div>
  )
}

/** Admins type "gei.ac.in" as often as "https://gei.ac.in"; a bare host would resolve relative. */
function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
