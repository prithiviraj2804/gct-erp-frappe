import { loadGridState } from '@bloomskill/table-engine'
import { BstTableShadcn } from '@bloomskill/table-shadcn'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { CELL_RENDERERS } from '@/pages/doctype/components/cell-renderers'
import { FallbackCell } from '@/pages/doctype/components/cells'
import { RowActions } from '@/pages/doctype/components/RowActions'
import type { SortField } from '@/pages/doctype/lib/doctype'
import { rowActions } from '@/pages/doctype/lib/row-actions'
import { NUMERIC_TYPES } from '@/pages/doctype/lib/fields'
import type { BstTableColumn } from '@/components/table/registry'
import '@/components/table/styles'
import type { DocRow, SchemaField } from '@/pages/doctype/types'

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

// `__bst`-prefixed ids are the library's convention for a column that is chrome rather than
// data: its Columns menu hides them, so the row-actions column stops appearing there as a blank,
// unlabelled entry a user could still reorder and pin. The prefix is the whole mechanism — the
// menu matches on the id, not on `meta`.
const ACTIONS_COLUMN = '__bstActions'

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
  const navigate = useNavigate()

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
        // `align` reaches the BODY cell only — the engine composes `bst-align-*` onto the td
        // and pins the th `text-align: left` — so the header needs its own hook or the label
        // sits at the far left of a column of right-aligned figures. See bst-table.css.
        meta: numeric ? { align: 'right' as const, headerClassName: 'bst-th-numeric' } : {},
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
        // Marks the column as chrome, not data: the engine skips it when deciding what is
        // editable, filterable or offered in the column panel. It does not replace the `cell`
        // below — the engine renders `columnDef.cell` for any column that supplies one.
        meta: { type: 'action' },
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
        // No `shadow-card` here: Tailwind emits utilities inside `@layer utilities` and the
        // adapter's `.sc-card` rule is unlayered, so the utility lost to the package every time.
        // The card's elevation is set on `.sc-card` in bst-table.css instead.
        // Persist + restore this table's view (localStorage). Distinct from the settings gear,
        // which toggles *features*; this captures how the data is currently *arranged*.
        gridState={{ key: gridKey }}
        // ---- Chrome (the `show*` layer) --------------------------------------------------
        showToolbar
        showSearch
        showColumnsMenu
        showPagination
        // No `showDensityToggle`. Density is ONE app-wide preference (the status bar's control,
        // `shared/appearance/density.ts`), not a per-table setting a user would have to set
        // again on every screen and every new doctype. The grid reads it from `data-density` on
        // <html> through `bst-table.css`, so the rows still change — the control just isn't here.
        // The settings gear → a per-table sheet where the user turns the features below on/off
        // at runtime, persisted per table. Only provisioned features appear, so everything the
        // grid is wired for is here and nothing it isn't.
        showSettings={{ persistKey: gridKey }}
        showShortcuts
        showFilterBuilder
        showSelectionInfo
        // NOT enabled by default, and each for its own reason. All three remain one click away
        // in the settings gear above, which is the point of having a gear: the DEFAULT should be
        // the view a person wants on a Tuesday, not a demonstration of everything the grid can do.
        //
        // showStatusBar     — printed "2 rows" in a band directly under a footer already saying
        //                     "1–2 of 2". Two footers, one fact.
        // showFormatBuilder — conditional formatting. A real feature, and not one that earns a
        //                     permanent button beside Export and Columns on every screen.
        // enableColumnFilterRow — a permanent row of text inputs under every header. The Filters
        //                     button opens the same thing on demand; the row is a whole band of
        //                     chrome that is empty almost all of the time.
        // ---- Behaviour (the `enable*` layer) ---------------------------------------------
        enableColumnFilters
        enableSetFilter
        enableRowSelection
        enableColumnPinning
        enableColumnOrdering
        enableGrouping
        // No `enableRowPinning`. It put a pin button in EVERY row of every list — a permanent
        // column of chrome, ~28px wide, for an action almost nobody takes, sitting between the
        // selection checkbox and the first real column. Column pinning stays: that one is about
        // reading a wide table, which is a thing an ERP does constantly.
        enableCellSelection
        enableClipboard
        enableContextMenu
        // Right-click used to return only the engine's defaults (Copy / Export / Autosize)
        // while the `⋯` button eight pixels away did Open / Edit / Delete — two menus, two
        // gestures, zero overlap, on the same object. The row's actions come first: the record
        // is what the user aimed at.
        getContextMenuItems={({ row, defaultItems }) => {
          if (!row) return defaultItems
          const mine = rowActions({
            href: rowPath(row),
            canWrite,
            canDelete,
            navigate,
            onDelete: () => onDelete(row),
          }).map(({ key, label, Icon, destructive, run }) => ({
            key,
            icon: <Icon aria-hidden="true" className="size-4" />,
            label: destructive ? <span className="text-destructive">{label}</span> : label,
            onSelect: run,
          }))
          return defaultItems.length ? [...mine, { separator: true }, ...defaultItems] : mine
        }}
        enableExport={{ fileName: label }}
        pagination={{ pageSize }}
        pageSizeOptions={[20, 50, 100]}
      />
    </section>
  )
}
