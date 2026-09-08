import { ArrowRightIcon, CheckCircle2Icon } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useAttentionLeads, type AttentionLead } from '@/shell/home/lib/use-attention'

/**
 * "Needs your attention" — the overdue and due-today leads, so the user lands on their actual work
 * rather than a launcher alone. Every row is the same permission-scoped Admission Enquiry the list
 * screen shows, and links straight to it. Fails quiet: a load error renders nothing rather than
 * taking a section of the home down, and an empty result is a genuine "all caught up", not a gap.
 */
export function AttentionList() {
  const { data: leads, isPending, isError } = useAttentionLeads()

  if (isError) return null

  return (
    <section
      aria-labelledby="attention-heading"
      className="overflow-hidden rounded-lg border border-border bg-card shadow-card"
    >
      <header className="flex items-center justify-between px-(--card-pad) py-(--row-pad-y)">
        <h2 id="attention-heading" className="text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">
          Needs your attention
        </h2>
        <Link
          to="/admission/admission-enquiry"
          className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Open Admission
        </Link>
      </header>

      {isPending ? (
        <LoadingRows />
      ) : leads.length === 0 ? (
        <AllClear />
      ) : (
        <ul className="border-t border-border">
          {leads.map((lead) => (
            <AttentionRow key={lead.name} lead={lead} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AttentionRow({ lead }: { lead: AttentionLead }) {
  const badge = stateBadge(lead.follow_up_state)
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/admission/admission-enquiry/${encodeURIComponent(lead.name)}`}
        className="group flex items-center gap-3 px-(--card-pad) py-(--row-pad-y) transition-colors duration-150 ease-out hover:bg-accent active:bg-accent-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground"
        >
          {initials(lead.student_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {lead.student_name ?? 'Unnamed lead'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {lead.last_outcome ? `Last: ${lead.last_outcome}` : 'No contact logged yet'}
          </span>
        </span>
        {badge && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              badge.className,
            )}
          >
            <span className={cn('size-1.5 rounded-full', badge.dot)} aria-hidden="true" />
            {badge.label}
          </span>
        )}
        <ArrowRightIcon
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}

function stateBadge(state: string | null) {
  if (state === 'Overdue') {
    return {
      label: 'Overdue',
      className: 'bg-destructive-subtle text-destructive-subtle-foreground',
      dot: 'bg-destructive',
    }
  }
  if (state === 'Due Today') {
    return { label: 'Due today', className: 'bg-warning-subtle text-warning-subtle-foreground', dot: 'bg-warning' }
  }
  return null
}

function initials(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '—'
}

function LoadingRows() {
  return (
    <ul className="border-t border-border">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3.5 border-b border-border px-5 py-3 last:border-b-0">
          <Skeleton className="size-8 shrink-0 rounded-full bg-skeleton" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  )
}

function AllClear() {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-5">
      <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        No follow-ups due — you&rsquo;re all caught up.
      </p>
    </div>
  )
}
