import { FilterIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'

import { CELL_RENDERERS } from '@/screens/doctype/components/cell-renderers'
import { FallbackCell } from '@/screens/doctype/components/cells'
import { NUMERIC_TYPES, type Density } from '@/screens/doctype/lib/fields'
import type { SortField } from '@/screens/doctype/lib/doctype'
import type { ColumnFilter } from '@/screens/doctype/lib/filters'
import { BstTable, type BstTableColumn } from '@/shared/components/table/BstTable'
import { Checkbox } from '@/shared/ui/checkbox'
import { cn } from '@/shared/lib/utils'
import type { DocRow, SchemaField } from '@/screens/doctype/types'

/**
 * The list grid — every `/{module}/{doctype}` screen's table.
 *
 * ## Why this is client-side, and what that costs
 *
 * The engine (TanStack v9, through `@bloomskill/table-engine`) sorts, searches and paginates
 * over an array in memory, and it cannot be told otherwise: `useBstTable` calls `useTable` with
 * a fixed option set — no `manualPagination`, no `manualSorting`, no `rowCount`, and no
 * state/`onStateChange` passthrough — so there is no way to hand it one server page and have
 * its footer, its header clicks or its search mean anything. Feeding it a page would produce a
 * table that says "1–20 of 20" of four thousand rows and sorts only what is on screen.
 *
 * So the list loads its rows up to `LIST_ROW_CAP` and the engine owns the presentation. The
 * division that falls out of that is worth stating, because it is the whole design:
 *
 * - **The server selects.** Filters and search stay where they were — URL state, sent to
 *   Frappe, permissions applied, `get_count` still honest. Narrowing is what keeps the fetch
 *   inside the cap.
 * - **The client presents.** Sorting, paging and column resizing are the engine's, over the
 *   rows already loaded, with no request behind any of them.
 *
 * What that gave up, so nobody rediscovers it as a bug: sort and page are no longer URL state,
 * because the engine owns them and will not report them back; column widths are no longer
 * persisted, for the same reason; and a doctype with more rows than the cap is truncated, which
 * the screen says out loud rather than showing a short list that looks complete.
 *
 * ## Everything else is still the app's
 *
 * Cells render through `CELL_RENDERERS`, so a Link is the same link it is on a record page.
 * Selection is the app's checkbox and `RowActions` is the app's menu — the engine has a feature
 * for neither. The typed column filters moved to the toolbar rather than staying in the header,
 * for a reason `ColumnFilterMenu` records; the header keeps a marker showing which columns they
 * constrain.
 */
export const LIST_ROW_CAP = 2000

/** Rows per page the grid opens on, and the first of `pageSizeOptions`. */
export const DEFAULT_PAGE_SIZE = 20

/** Reserved column ids. Prefixed so they can never collide with a fieldname. */
const SELECT_COLUMN = '__select'
const ACTIONS_COLUMN = '__actions'

export interface GridSelection {
  selected: ReadonlySet<string>
  onToggle: (name: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
}

interface DoctypeGridProps {
  doctype: string
  /** The visible columns, in order. The first is the row's identity and links to the record. */
  columns: SchemaField[]
  rows: DocRow[]
  /** Screen-reader name for the grid. */
  label: string
  rowPath: (row: DocRow) => string
  density: Density
  /** The doctype's authored sort, used as the grid's opening order. */
  defaultSort: SortField
  /** Active typed filters — read only, to mark the columns they constrain. */
  activeFilters: ColumnFilter[]
  /** Rows per page the grid opens on. Defaults to 20, as the server-paged list did. */
  pageSize?: number
  selection?: GridSelection
  rowActions?: (row: DocRow) => ReactNode
}

export function DoctypeGrid({
  doctype,
  columns,
  rows,
  label,
  rowPath,
  density,
  defaultSort,
  activeFilters,
  pageSize = DEFAULT_PAGE_SIZE,
  selection,
  rowActions,
}: DoctypeGridProps) {
  const filterByField = useMemo(() => new Set(activeFilters.map((filter) => filter.field)), [activeFilters])

  const allSelected = !!selection && rows.length > 0 && rows.every((row) => selection.selected.has(row.name))
  const someSelected = !!selection && rows.some((row) => selection.selected.has(row.name))

  const gridColumns = useMemo<BstTableColumn<DocRow>[]>(() => {
    const out: BstTableColumn<DocRow>[] = []

    if (selection) {
      out.push({
        id: SELECT_COLUMN,
        size: 44,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => (
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => selection.onToggleAll(checked === true)}
            aria-label={allSelected ? 'Clear selection' : 'Select every row'}
          />
        ),
        cell: (ctx) => {
          const row = ctx.row.original
          const checked = selection.selected.has(row.name)
          return (
            <Checkbox
              checked={checked}
              onCheckedChange={(next) => selection.onToggle(row.name, next === true)}
              aria-label={`Select ${row.name}`}
            />
          )
        },
      })
    }

    columns.forEach((field, index) => {
      const identity = index === 0
      const numeric = NUMERIC_TYPES.has(field.fieldtype)

      out.push({
        id: field.fieldname,
        accessorKey: field.fieldname,
        // A ReactNode header is safe here in a way it is not in `ChildTable`: the adapter's
        // Columns menu falls back to the column id whenever a header stops being a string, and
        // this grid does not show that menu — the app's own `ViewMenu` owns column visibility,
        // because it also owns density and the saved views beside it.
        //
        // Nothing in here is interactive, and that is a constraint rather than a preference:
        // the engine renders this inside a `role="button"` div carrying the sort handler, so a
        // control placed here would be a button inside a button and would be absorbed into its
        // accessible name. The filter *controls* live on the toolbar (`ColumnFilterMenu`); what
        // stays is the marker saying this column is one of the constrained ones.
        header: () => (
          <>
            <span className="truncate">{field.label ?? field.fieldname}</span>
            {filterByField.has(field.fieldname) && (
              <FilterIcon className="size-3 shrink-0 fill-primary/20 text-primary" aria-hidden="true" />
            )}
          </>
        ),
        meta: { align: numeric ? 'right' : undefined },
        size: numeric ? 120 : identity ? 220 : undefined,
        cell: (ctx) => {
          const row = ctx.row.original
          const value = row[field.fieldname]

          // The identity column is the row's only route to its record — the engine gives a
          // `<tr>` no click hook, so the link is the cell rather than the row. That is the
          // better affordance anyway: it is reachable by keyboard and it says where it goes.
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

    if (rowActions) {
      out.push({
        id: ACTIONS_COLUMN,
        header: '',
        size: 56,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        cell: (ctx) => <div className="flex justify-end">{rowActions(ctx.row.original)}</div>,
      })
    }

    return out
  }, [columns, doctype, rowPath, rowActions, selection, allSelected, someSelected, filterByField])

  // Seeded, not controlled. The engine reports no state back, so this is the opening order and
  // the user's header clicks take it from there — which is why the doctype's authored
  // `sort_field` is the right seed and a URL param would be a promise the grid cannot keep.
  const initialState = useMemo(
    () => ({
      sorting: [{ id: defaultSort.field, desc: defaultSort.order === 'desc' }],
    }),
    [defaultSort.field, defaultSort.order],
  )

  return (
    <BstTable
      label={label}
      className={cn('bst-embedded', density === 'compact' && 'bst-density-compact')}
      data={rows}
      columns={gridColumns}
      getRowId={(row) => row.name}
      initialState={initialState}
      // The adapter's toolbar is off entirely: its search would be a second search box beside
      // the app's (which searches `search_fields` server-side, across fields this grid does not
      // show), and its Columns menu a second column menu beside `ViewMenu`.
      showToolbar={false}
      pagination={{ pageSize }}
      pageSizeOptions={[20, 50, 100]}
    />
  )
}
