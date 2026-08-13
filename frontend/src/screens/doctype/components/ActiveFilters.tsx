import { XIcon } from 'lucide-react'

import { describeFilter, type ColumnFilter } from '@/screens/doctype/lib/filters'
import type { SchemaField } from '@/screens/doctype/types'

/**
 * A single row of removable chips for everything currently narrowing the list.
 *
 * Both filter channels land here — the toolbar's Select/Check equality filters and the typed
 * column filters — so there is one place that answers "why am I seeing these rows?" and one place
 * to undo any of it. The global search stays in its own box; a chip for it would duplicate a
 * control the user is already looking at.
 *
 * Renders nothing when there is nothing active, so the caller can mount it unconditionally.
 */
export function ActiveFilters({
  flatFilters,
  columnFilters,
  fieldsByName,
  onRemoveFlat,
  onRemoveColumn,
  onClearAll,
}: {
  /** Select/Check equality filters, by fieldname. */
  flatFilters: Record<string, string>
  columnFilters: ColumnFilter[]
  fieldsByName: Map<string, SchemaField>
  onRemoveFlat: (field: string) => void
  onRemoveColumn: (field: string) => void
  onClearAll: () => void
}) {
  const flat = Object.entries(flatFilters)
  const total = flat.length + columnFilters.length
  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {flat.map(([fieldname, value]) => {
        const field = fieldsByName.get(fieldname)
        const label = field?.label ?? fieldname
        const shown = field?.fieldtype === 'Check' ? (value === '1' ? 'Yes' : 'No') : value
        return (
          <Chip
            key={`flat:${fieldname}`}
            onRemove={() => onRemoveFlat(fieldname)}
            label={`${label}: ${shown}`}
          >
            {label}: <span className="font-normal">{shown}</span>
          </Chip>
        )
      })}

      {columnFilters.map((filter) => {
        const field = fieldsByName.get(filter.field)
        const text = field ? describeFilter(field, filter) : `${filter.field} ${filter.op} ${filter.value}`
        return (
          <Chip key={`col:${filter.field}`} onRemove={() => onRemoveColumn(filter.field)} label={text}>
            {text}
          </Chip>
        )
      })}

      {total > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

function Chip({
  children,
  label,
  onRemove,
}: {
  children: React.ReactNode
  /** Plain-text form, for the remove button's accessible name. */
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pr-1 pl-2.5 text-xs font-medium text-foreground">
      <span className="max-w-[16rem] truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <XIcon className="size-3" aria-hidden="true" />
      </button>
    </span>
  )
}
