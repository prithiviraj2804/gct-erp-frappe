import { CELL_RENDERERS } from '@/pages/doctype/components/cell-renderers'
import { FallbackCell } from '@/pages/doctype/components/cells'
import { cn } from '@/lib/utils'
import type { DocRecord, SchemaField } from '@/pages/doctype/types'

interface RecordSummaryProps {
  fields: SchemaField[]
  doc: DocRecord
  doctype: string
}

/**
 * The facts someone opened this record to check, above everything else.
 *
 * A record page whose first screenful is "Basic Information" with eleven fields in it makes the
 * reader do the summarising. Four facts across the top does it for them, and the sections below
 * stop being the only way in.
 *
 * Which four is the one thing the schema genuinely cannot say — `in_list_view` answers "what
 * identifies a row in a table", which is a different question — so it is a named override in
 * `registry.ts`, with a defensible default (the first short scalar fields the layout places)
 * when a module has not decided yet.
 */
export function RecordSummary({ fields, doc, doctype }: RecordSummaryProps) {
  if (fields.length === 0) return null

  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card',
        STRIP_GRID[Math.min(fields.length, 4)],
      )}
    >
      {fields.map((field) => {
        const Cell = CELL_RENDERERS[field.fieldtype] ?? FallbackCell
        return (
          <div key={field.fieldname} className="bg-card px-4 py-3">
            <dt className="truncate text-xs text-muted-foreground">{field.label ?? field.fieldname}</dt>
            <dd className="mt-1 truncate text-sm font-medium text-foreground">
              <Cell value={doc[field.fieldname]} field={field} doctype={doctype} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/**
 * Static class strings, so Tailwind's scanner can see every one it may need to emit — the same
 * device `RecordSection`'s COLUMN_GRID uses.
 *
 * Every entry divides evenly at EVERY breakpoint it names, which is the whole point. The strip
 * separates its tiles by showing a `bg-border` container through a `gap-px`, so a cell no tile
 * lands in is not blank — it is a slab of border colour. Three fields in `lg:grid-cols-4` drew
 * exactly that: a grey block occupying a quarter of the strip. Three go to three columns rather
 * than being padded into four.
 */
const STRIP_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}
