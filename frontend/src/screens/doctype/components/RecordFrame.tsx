import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'

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
    <div className={cn('mx-auto w-full px-6 py-8', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div>
  )
}

export function RecordSkeleton() {
  return (
    <RecordFrame>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-8 w-72" />
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-6" role="status" aria-live="polite">
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <Skeleton className="h-3 w-32" />
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, field) => (
                <div key={field}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <span className="sr-only">Loading record</span>
      </div>
    </RecordFrame>
  )
}
