import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The measure a record is read and edited at.
 *
 * Bounded, unlike the list's `PageFrame`: a two-column form stretched across a 2560px monitor
 * gives 700px inputs and reads as broken. `max-w-5xl` rather than the narrower `4xl` the record
 * page used before, because sections now honour their authored column count and a three-column
 * section needs the room.
 *
 * Shared by the record view, the edit form and the create form so all three sit on the same
 * grid — pressing Edit must not move a single field sideways.
 */
export function RecordFrame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  // `wide` buys back exactly what the context rail spends. Without it, adding a 280px column
  // to the 5xl measure would narrow the form itself — the rail would be paid for by the thing
  // it is meant to support.
  return (
    <div className={cn('mx-auto w-full px-(--page-gutter-x) py-(--page-gutter-y)', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div>
  )
}

/**
 * Form beside rail. Defined once and used by both the real layout and the skeleton — a
 * duplicated grid string is how a skeleton silently stops matching the page it stands in for.
 *
 * Below `xl` the rail stacks under the form rather than squeezing it: at that width a 280px
 * column would leave the form narrower than the phone layout it degrades to.
 */
export const RECORD_GRID = 'xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start xl:gap-(--section-stack)'

/**
 * The record body: the authored form, and the context rail beside it.
 *
 * One component for all three branches — read, edit, tabbed — because the rail decides the
 * frame's width. Splitting the decision would let pressing Edit move every field sideways,
 * which is the one thing RecordFrame exists to prevent.
 */
export function RecordLayout({
  aside,
  children,
  topOfBody,
}: {
  aside: React.ReactNode
  children: React.ReactNode
  /**
   * True when no summary strip rendered, so this is the first thing under the page header.
   * The gap above the body means two different things and needs two different tokens: header →
   * body is `--page-stack`, summary-card → form-card is `--section-stack`.
   */
  topOfBody: boolean
}) {
  const top = topOfBody ? 'mt-(--page-stack)' : 'mt-(--section-stack)'
  if (!aside) return <div className={top}>{children}</div>

  return (
    <div className={cn(top, RECORD_GRID)}>
      <div className="min-w-0">{children}</div>
      {/* Sticky, so the hierarchy and the record's state stay readable while a long form is
          scrolled. `top-6` clears the 52px topbar plus the frame's own padding. */}
      <aside className="mt-(--section-stack) flex flex-col gap-(--section-stack) xl:sticky xl:top-(--page-gutter-y) xl:mt-0">{aside}</aside>
    </div>
  )
}

/**
 * A record or a form, while it loads.
 *
 * ONE prop, not two. It used to draw `max-w-5xl` with a four-tile summary strip and no rail,
 * while the record screen it stood in for renders `wide` (because `hasRecordContext` is true for
 * every Frappe record — they all carry `creation` and `modified`), so every record open jumped
 * 1024 → 1280px and a 280px column appeared from nowhere. The same skeleton also served the
 * create screen, which draws neither a strip nor a rail.
 *
 * Width derives from `variant` rather than taking a second `wide` prop: no caller would ever
 * pair `variant='record'` with a narrow frame, so a second prop is surface that can only be set
 * wrong.
 */
export function RecordSkeleton({ variant = 'record' }: { variant?: 'record' | 'form' }) {
  const isRecord = variant === 'record'
  const sections = (
    <div className="flex flex-col gap-(--section-stack)">
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="rounded-xl border border-border bg-card p-(--card-pad) shadow-card">
          <Skeleton className="h-3 w-32" />
          <div className="mt-(--field-stack) grid gap-x-8 gap-y-(--field-stack) sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, field) => (
              <div key={field}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <RecordFrame wide={isRecord}>
      <Skeleton className="mb-3 h-4 w-56" />
      {/* h-10 for the row, h-5 for the title: the header's height is set by its buttons, not by
          the 20px heading, and drawing a 32px title slab is what made the body jump on load. */}
      <div className="flex h-10 items-center justify-between gap-3">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-10 w-40" />
      </div>

      {isRecord && (
        // The summary strip's `px-4 py-3` matches RecordSummary's tile exactly — if that tile
        // ever moves to `--card-pad`, this moves with it or the skeleton stops tracking density.
        <div className="mt-(--page-stack) grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card px-4 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(isRecord ? 'mt-(--section-stack)' : 'mt-(--page-stack)', isRecord && RECORD_GRID)}
        role="status"
        aria-live="polite"
      >
        {isRecord ? <div className="min-w-0">{sections}</div> : sections}
        {isRecord && (
          <aside className="mt-(--section-stack) flex flex-col gap-(--section-stack) xl:mt-0">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-(--card-pad) shadow-card">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            ))}
          </aside>
        )}
        <span className="sr-only">{isRecord ? 'Loading record' : 'Loading form'}</span>
      </div>
    </RecordFrame>
  )
}
