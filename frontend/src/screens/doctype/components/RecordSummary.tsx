import { CELL_RENDERERS } from '@/screens/doctype/components/cell-renderers'
import { FallbackCell } from '@/screens/doctype/components/cells'
import type { DocRecord, SchemaField } from '@/screens/doctype/types'

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
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card lg:grid-cols-4">
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
