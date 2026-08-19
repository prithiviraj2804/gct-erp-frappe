import { loadGridState } from '@bloomskill/table-engine'
import { BstTableShadcn } from '@bloomskill/table-shadcn'
import { useMemo } from 'react'
import { Link } from 'react-router'

import { CELL_RENDERERS } from '@/screens/doctype/components/cell-renderers'
import { FallbackCell } from '@/screens/doctype/components/cells'
import { RowActions } from '@/screens/doctype/components/RowActions'
import type { SortField } from '@/screens/doctype/lib/doctype'
import { NUMERIC_TYPES } from '@/screens/doctype/lib/fields'
import type { BstTableColumn } from '@/shared/components/table/registry'
import '@/shared/components/table/styles'
import { cn } from '@/shared/lib/utils'
import type { DocRow, SchemaField } from '@/screens/doctype/types'

/**
 * The list grid — every `/{module}/{doctype}` screen's table.
 *
 * This is the stock `@bloomskill/table-shadcn` component with its own chrome turned on: the
 * toolbar's global search, the column-filter builder, the show/hide columns menu, sorting,
 * client-side pagination, the density toggle and CSV/Excel/print export are all the library's,
 * not the app's. The app supplies three things the library cannot know: the columns (from the
 * doctype schema), how a Frappe value is rendered (the `cell` renderers — a `Link` is a picker
 * link, a `Datetime` is timezone-safe), and where a row goes (the identity column's route +
 * the per-row actions menu).
 *
 * Because the engine sorts / searches / paginates over `data` in memory, the screen hands it
 * every row up to {@link LIST_ROW_CAP} and says so out loud when a doctype overflows that.
 */
export const LIST_ROW_CAP = 2000

/** Rows per page the grid opens on, and the first of `pageSizeOptions`. */
export const DEFAULT_PAGE_SIZE = 20

const ACTIONS_COLUMN = '__actions'

interface DoctypeTableProps {
  doctype: string
  /** The visible columns, in order. The first is the row's identity and links to the record. */
  columns: SchemaField[]
  rows: DocRow[]
  /** Screen-reader name for the grid. */
  label: string
  rowPath: (row: DocRow) => string
  /** The doctype's authored sort, used as the grid's opening order. */
  defaultSort: SortField
  /** Columns hidden by default (registry override). The columns menu can switch them back on. */
  hiddenColumns?: readonly string[]
  titleField: string
  canWrite: boolean
  canDelete: boolean
  onDelete: (row: DocRow) => void
  /** Rows per page the grid opens on. Defaults to 20. */
  pageSize?: number
}

export function DoctypeTable({
  doctype,
  columns,
  rows,
  label,
  rowPath,
  defaultSort,
  hiddenColumns,
  titleField,
  canWrite,
  canDelete,
  onDelete,
  pageSize = DEFAULT_PAGE_SIZE,
}: DoctypeTableProps) {
  const gridColumns = useMemo<BstTableColumn<DocRow>[]>(() => {
    const out: BstTableColumn<DocRow>[] = []

    columns.forEach((field, index) => {
      const identity = index === 0
      const numeric = NUMERIC_TYPES.has(field.fieldtype)

      out.push({
        id: field.fieldname,
        accessorKey: field.fieldname,
        // A plain-string header: the library's columns menu and filter builder both label their
        // entries from it, so a ReactNode would relabel them by column id.
        header: field.label ?? field.fieldname,
        // The identity column is the row's only link to its record — never hide it away.
        enableHiding: !identity,
        meta: { align: numeric ? 'right' : undefined },
        size: numeric ? 120 : identity ? 240 : undefined,
        cell: (ctx) => {
          const row = ctx.row.original
          const value = row[field.fieldname]

          if (identity) {
            return (
              <Link
                to={rowPath(row)}
                className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {value === null || value === undefined || value === '' ? row.name : String(value)}
              </Link>
            )
          }

          const Cell = CELL_RENDERERS[field.fieldtype] ?? FallbackCell
          return <Cell value={value} field={field} doctype={doctype} />
        },
      })
    })

    if (canWrite || canDelete) {
      out.push({
        id: ACTIONS_COLUMN,
        header: '',
        size: 56,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        cell: (ctx) => (
          <div className="flex justify-end">
            <RowActions
              href={rowPath(ctx.row.original)}
              subject={String(ctx.row.original[titleField] ?? ctx.row.original.name)}
              canWrite={canWrite}
              canDelete={canDelete}
              onDelete={() => onDelete(ctx.row.original)}
            />
          </div>
        ),
      })
    }

    return out
  }, [columns, doctype, rowPath, titleField, canWrite, canDelete, onDelete])

  // The per-table view (sort, filters, column order/size/visibility, grouping, pinning) is
  // persisted to localStorage under this key and restored on the next visit — the native
  // replacement for the app's old saved views.
  const gridKey = `bst:doctype:${doctype}`

  // Seeded, not controlled — the library owns the view from here. A stored snapshot wins (the
  // user's own arrangement, restored flash-free); otherwise the doctype's authored sort is the
  // opening order and the registry override's hidden columns start switched off.
  const initialState = useMemo<Record<string, unknown>>(() => {
    const saved = loadGridState(gridKey)
    if (saved) return saved as unknown as Record<string, unknown>
    return {
      sorting: [{ id: defaultSort.field, desc: defaultSort.order === 'desc' }],
      columnVisibility: Object.fromEntries((hiddenColumns ?? []).map((f) => [f, false])),
    }
  }, [gridKey, defaultSort.field, defaultSort.order, hiddenColumns])

  return (
    <section aria-label={label}>
      <BstTableShadcn
        data={rows}
        columns={gridColumns}
        getRowId={(row) => row.name}
        initialState={initialState}
        className={cn('shadow-card')}
        // Persist + restore this table's view (localStorage). Distinct from the settings gear,
        // which toggles *features*; this captures how the data is currently *arranged*.
        gridState={{ key: gridKey }}
        // ---- Chrome (the `show*` layer) --------------------------------------------------
        showToolbar
        showSearch
        showColumnsMenu
        showPagination
        showDensityToggle
        // The settings gear → a per-table sheet where the user turns the features below on/off
        // at runtime, persisted per table. Only provisioned features appear, so everything the
        // grid is wired for is here and nothing it isn't.
        showSettings={{ persistKey: gridKey }}
        showShortcuts
        showStatusBar
        showFilterBuilder
        showFormatBuilder
        showSelectionInfo
        // ---- Behaviour (the `enable*` layer) ---------------------------------------------
        enableColumnFilters
        enableColumnFilterRow
        enableSetFilter
        enableRowSelection
        enableColumnPinning
        enableColumnOrdering
        enableGrouping
        enableRowPinning
        enableCellSelection
        enableClipboard
        enableContextMenu
        enableExport={{ fileName: label }}
        pagination={{ pageSize }}
        pageSizeOptions={[20, 50, 100]}
      />
    </section>
  )
}
