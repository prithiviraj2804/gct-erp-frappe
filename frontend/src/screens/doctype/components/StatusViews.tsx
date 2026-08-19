import { Link, useLocation } from 'react-router'

import { useDocCount } from '@/screens/doctype/hooks/use-doctype'
import { STATUS_PARAM, statusOptions, statusTone, TONE_DOT_CLASS } from '@/screens/doctype/lib/status'
import { screenOverride } from '@/screens/doctype/registry'
import { cn } from '@/shared/lib/utils'
import type { SchemaField } from '@/screens/doctype/types'

interface ViewLinkProps {
  doctype: string
  field: string
  /** The status this view selects, or null for "All". */
  value: string | null
  label: string
  active: boolean
  /** Dot colour for the status word, from the module's own vocabulary. */
  toneClass?: string
  search: string
}

/**
 * One view, with its own count.
 *
 * The count is a component-per-tab rather than a batched call because `frappe.client.get_count`
 * counts one filter set per request — and each of these is the SAME query key the list itself
 * uses for that filter, so switching to a view finds its total already cached rather than
 * refetching it.
 */
function ViewLink({ doctype, field, value, label, active, toneClass, search }: ViewLinkProps) {
  const count = useDocCount(doctype, value === null ? [] : [[field, '=', value]])

  return (
    <Link
      to={{ search }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150 ease-out',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
        active
          ? 'border-primary font-semibold text-primary'
          : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
      )}
    >
      {toneClass && <span className={cn('size-1.5 rounded-full', toneClass)} aria-hidden="true" />}
      <span>{label}</span>
      {/* A missing count prints nothing rather than a zero — an unresolved request is not
          "none". `tabular-nums` so the strip does not jiggle as the numbers land. */}
      {count.data !== undefined && (
        <span className={cn('text-xs tabular-nums', active ? 'text-primary/80' : 'text-muted-foreground/80')}>
          {count.data.toLocaleString()}
        </span>
      )}
    </Link>
  )
}

interface StatusViewsProps {
  doctype: string
  field: SchemaField
  /** The status in the URL, or null for "All". */
  active: string | null
}

/**
 * The list's status views: All, then one per status word, each carrying its own count.
 *
 * This is the one piece of list chrome that stays the app's rather than the table library's,
 * and it earns that because it works on a different set of rows. The library's toolbar filters
 * what has already been fetched; a view here changes what the SERVER selects, so choosing
 * "Contacted" narrows the query rather than hiding rows from the cap of 2000 already loaded.
 *
 * The counts are the point. "How many are still New?" is the question a list of enquiries is
 * opened to answer, and answering it above the table means nobody has to filter to find out.
 */
export function StatusViews({ doctype, field, active }: StatusViewsProps) {
  const location = useLocation()
  const options = statusOptions(field)
  const tones = screenOverride(doctype).statusTones

  /** The URL for a view, preserving every other parameter the page is carrying. */
  const searchFor = (value: string | null) => {
    const params = new URLSearchParams(location.search)
    if (value === null) params.delete(STATUS_PARAM)
    else params.set(STATUS_PARAM, value)
    const query = params.toString()
    return query ? `?${query}` : ''
  }

  return (
    <nav aria-label={`${field.label ?? 'Status'} views`} className="-mb-px flex gap-1 overflow-x-auto">
      <ViewLink
        doctype={doctype}
        field={field.fieldname}
        value={null}
        label="All"
        active={active === null}
        search={searchFor(null)}
      />
      {options.map((option) => (
        <ViewLink
          key={option}
          doctype={doctype}
          field={field.fieldname}
          value={option}
          label={option}
          active={active === option}
          toneClass={TONE_DOT_CLASS[statusTone(option, tones)]}
          search={searchFor(option)}
        />
      ))}
    </nav>
  )
}
