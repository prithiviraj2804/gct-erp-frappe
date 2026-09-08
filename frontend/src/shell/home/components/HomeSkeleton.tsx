import { Skeleton } from '@/components/ui/skeleton'

/**
 * The dashboard's shape while the rail, menus and branding resolve. Mirrors the real layout —
 * masthead, KPI strip, then the two-column body — so nothing reflows when the data lands.
 *
 * Which means its SPACING has to be the real page's too, from the same tokens. It was written
 * with literals (`gap-8 px-6 py-8`) while `HomeScreen` used the density tokens, so the two drifted
 * apart the moment those tokens moved — and a skeleton that is the wrong size is worse than none:
 * it promises a layout and then reflows into a different one, which is precisely the jump it
 * exists to prevent.
 */
export function HomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-(--page-stack) px-(--page-gutter-x) py-(--page-gutter-y)" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <Skeleton className="hidden size-16 rounded-xl sm:block" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-(--section-stack) sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>

      <div className="grid gap-(--section-stack) lg:grid-cols-3">
        <div className="grid gap-(--section-stack) sm:grid-cols-2 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl lg:col-span-1" />
      </div>

      <span className="sr-only">Loading your home</span>
    </div>
  )
}
