import { useMemo } from 'react'

import { CELL_RENDERERS } from '@/screens/doctype/components/cell-renderers'
import { createFrappeCellTypes } from '@/screens/doctype/components/cell-types'
import { FallbackCell } from '@/screens/doctype/components/cells'
import { blankChildRow, childColumnMeta, childRowId } from '@/screens/doctype/lib/child-grid'
import { TEMP_ROW_PREFIX } from '@/screens/doctype/lib/form'
import { BstTable, type BstTableColumn } from '@/shared/components/table/BstTable'
import type { ChildSchema, DocRecord, SchemaField } from '@/screens/doctype/types'

interface ChildTableProps {
  schema: ChildSchema
  /** The parent's value for this Table field. Frappe sends child rows as an array of objects. */
  value: unknown
  label: string
  /**
   * Write-back for the whole row set.
   *
   * Its presence is what makes the grid editable — there is no `editable` boolean, because a
   * grid that can be edited and has nowhere to put the result is a bug that looks like a
   * feature. The record page omits it and gets exactly the read-only grid it had; the form
   * passes the parent's setter and gets cells, row actions and validation.
   */
  onChange?: (rows: DocRecord[]) => void
  /** True while a save is in flight — the whole grid freezes, as the whole form does. */
  disabled?: boolean
}

/**
 * Above this many rows a child grid stops being something you read and becomes something you
 * search. Below it, a toolbar and a "Rows per page" footer are more chrome than the grid is
 * worth — three rows do not need a page size. Doubles as the page size once chrome is on.
 */
const CHROME_THRESHOLD = 10

/**
 * A child table, rendered as a grid inside the record.
 *
 * No doctype in this app authors one yet. It exists because the day one does, the alternative
 * is a `Table` field falling through to the fallback cell and printing `[object Object]` — a
 * failure that looks like a rendering glitch rather than a missing feature, and would be found
 * by a user rather than by a test.
 *
 * Its columns come from the child's own `in_list_view`, exactly as Desk's grid does, so the
 * two cannot drift. `child_schemas` travels with the parent's schema, so this costs no request.
 *
 * Built on `BstTable`, the one table component in the app. The fit is exact here in a way it is
 * not anywhere else: the rows arrived inside the parent document, so the engine's client-side
 * sorting, searching and pagination are the whole feature with no request behind any of them.
 * `DoctypeGrid` uses the same component for the list and has to buy that with a row cap.
 *
 * ## Reading and writing are the same grid
 *
 * The engine renders a column's own `cell` for the read path and the cell-type registry's
 * editor for the edit path, which is what lets both surfaces be this one component. So a Link
 * in a child row is the same dotted-underline link it is everywhere else *and* opens the same
 * search picker the form uses; the engine owns the grid, the app keeps owning what a value
 * looks like and how it is typed. `components/cell-types.ts` is that registry.
 *
 * Editing is per cell rather than per row session. A row session defers every cell until the
 * row's own Save, which would put a second save inside a form that already has one — the user
 * would press the row's Save, then the document's, and could not tell which of them was the
 * one that mattered. Committing to the parent's form state on each cell keeps a single Save
 * button meaning a single thing.
 */
export function ChildTable({ schema, value, label, onChange, disabled }: ChildTableProps) {
  const rows = useMemo(() => (Array.isArray(value) ? (value as DocRecord[]) : []), [value])
  const writable = !!onChange

  const columns = useMemo<BstTableColumn<DocRecord>[]>(() => {
    const byName = new Map(schema.fields.map((field) => [field.fieldname, field]))
    const fields = schema.columns
      .map((fieldname) => byName.get(fieldname))
      .filter((field): field is SchemaField => !!field)

    const grid: BstTableColumn<DocRecord>[] = fields.map((field) => ({
      id: field.fieldname,
      // The accessor is what the engine sorts and searches on, so it reads the raw value —
      // sorting a Currency column by its formatted string would order "₹1,000" before "₹9".
      accessorKey: field.fieldname,
      // Stays a plain string on purpose: the adapter's Columns menu falls back to the column
      // id the moment a header is a ReactNode, so a JSX header would relabel that menu `fee`
      // instead of `Fee`. Cell alignment is `meta.align`'s job instead.
      header: field.label ?? field.fieldname,
      size: fieldWidth(field),
      meta: childColumnMeta(field, schema.doctype, writable),
      cell: (ctx) => {
        const Cell = CELL_RENDERERS[field.fieldtype] ?? FallbackCell
        return <Cell value={ctx.row.original[field.fieldname]} field={field} doctype={schema.doctype} />
      },
    }))

    // The row buttons, from the engine's own `action` cell type. Last, unlabelled, and only
    // when the rows can actually be changed — a Delete on a record page would be a button that
    // silently edits nothing, since there is no write-back behind it.
    if (writable) {
      grid.push({
        id: '__actions',
        header: '',
        size: 150,
        enableSorting: false,
        enableHiding: false,
        meta: { type: 'action', actions: { delete: true, duplicate: true } },
      })
    }

    return grid
  }, [schema, writable])

  const cellTypes = useMemo(() => createFrappeCellTypes(), [])
  const createRow = useMemo(() => () => blankChildRow(schema.fields), [schema])

  if (columns.length === 0 || (rows.length === 0 && !writable)) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No {label.toLowerCase()}
      </p>
    )
  }

  // One threshold drives all of it, so the grid never shows half a toolbar: either this is a
  // short grid you read, or a long one you work. An editable grid always has a toolbar — that
  // is where "+ Add row" lives, and an empty child table with no way to add the first row is
  // the one state the read-only grid never had to handle.
  const interactive = rows.length > CHROME_THRESHOLD

  return (
    <BstTable
      label={label}
      data={rows}
      columns={columns}
      getRowId={childRowId}
      showToolbar={interactive || writable}
      showSearch={interactive}
      showColumnsMenu={interactive}
      // `false` renders every row and drops the footer — the short case.
      pagination={interactive ? { pageSize: CHROME_THRESHOLD } : false}
      pageSizeOptions={[10, 25, 50]}
      // Editing, and everything that hangs off it. `onDataChange` is the whole contract: the
      // engine never mutates `rows`, it hands back the next array and the parent form owns it.
      enableEditing={writable}
      enableValidation={writable}
      enableRowActions={writable}
      cellTypes={cellTypes}
      onDataChange={onChange}
      createRow={createRow}
      tempIdPrefix={TEMP_ROW_PREFIX}
      disabled={disabled}
      // The Save/Discard bar is the engine's bulk-commit of pending drafts. In cell mode there
      // are none — every commit lands immediately — so the bar would be a permanently empty
      // second save control next to the form's real one.
      showSaveBar={false}
    />
  )
}

/**
 * A starting width, not a fixed one — every column stays resizable.
 *
 * Numbers are narrow because they are short and right-aligned; the long-text types are wide
 * because at the default they wrap to three lines and make every row in the grid tall.
 */
function fieldWidth(field: SchemaField): number | undefined {
  if (field.fieldtype === 'Int' || field.fieldtype === 'Float' || field.fieldtype === 'Currency') {
    return 110
  }
  if (field.fieldtype === 'Check') return 90
  if (field.fieldtype === 'Text' || field.fieldtype === 'Small Text' || field.fieldtype === 'JSON') {
    return 280
  }
  return undefined
}
