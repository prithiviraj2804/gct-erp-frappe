import { FilterIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FILTER_CONTROLS } from '@/screens/doctype/components/column-filters/filter-registry'
import type { ColumnFilter, FilterOperator } from '@/screens/doctype/lib/filters'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { ScrollArea } from '@/shared/ui/scroll-area'
import type { SchemaField } from '@/screens/doctype/types'

/**
 * Every typed column filter, in one popover on the toolbar.
 *
 * It used to be an icon per column header, which is the AG Grid / MRT placement and is where
 * this pattern belongs. The grid engine took that away: it renders the whole header — label,
 * sort indicator and anything a `header` renderer returns — inside a single `role="button"`
 * div carrying the sort handler, and it only does so when the column is sortable, which
 * `createSortedRowModel` requires (it drops any sorting entry whose column fails `getCanSort`).
 * So the choice was a sortable header or an interactive filter inside one, and a control nested
 * in a `role="button"` is both invalid ARIA and swallowed into that button's accessible name —
 * "College Name Filter College Name ↕" is what a screen reader would have announced.
 *
 * Gathering them here loses the per-column adjacency and gains something back: setting three
 * filters is now three moves in one place rather than three hover-click-escape cycles. The
 * header still says which columns are constrained — `DoctypeGrid` renders a non-interactive
 * marker for that — so the information stayed where it was even though the control moved.
 */
export function ColumnFilterMenu({
  fields,
  active,
  onChange,
  onRemove,
}: {
  /** Every column that could carry a typed filter, in table order. */
  fields: SchemaField[]
  active: ColumnFilter[]
  onChange: (field: string, op: FilterOperator, value: string) => void
  onRemove: (field: string) => void
}) {
  const [open, setOpen] = useState(false)

  // Only the fieldtypes the registry has a control for. Rendering a labelled row with nothing
  // under it would read as a filter that is broken rather than one that does not exist.
  const filterable = useMemo(() => fields.filter((field) => !!FILTER_CONTROLS[field.fieldtype]), [fields])

  const byField = useMemo(() => new Map(active.map((filter) => [filter.field, filter])), [active])

  if (filterable.length === 0) return null

  const count = filterable.filter((field) => byField.has(field.fieldname)).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8', count > 0 && 'border-primary/40')}>
          <FilterIcon aria-hidden="true" />
          Filters
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-3 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Filter columns
        </p>
        {/* Capped height: a doctype with twelve filterable columns would otherwise open a
            popover taller than the viewport and put its last row off-screen. */}
        <ScrollArea className="max-h-96">
          <div className="flex flex-col gap-4 p-3">
            {filterable.map((field) => {
              const Control = FILTER_CONTROLS[field.fieldtype]!
              const value = byField.get(field.fieldname)

              return (
                <div key={field.fieldname} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{field.label ?? field.fieldname}</p>
                    {value && (
                      <button
                        type="button"
                        onClick={() => onRemove(field.fieldname)}
                        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Control
                    field={field}
                    value={value}
                    onChange={(filter) =>
                      filter ? onChange(filter.field, filter.op, filter.value) : onRemove(field.fieldname)
                    }
                  />
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
