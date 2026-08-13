import type { Filter } from 'frappe-js-sdk/lib/db/types'
import { DownloadIcon, PlusIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { BulkBar } from '@/screens/doctype/components/BulkBar'
import { DoctypeGrid, LIST_ROW_CAP } from '@/screens/doctype/components/DoctypeGrid'
import { ListToolbar } from '@/screens/doctype/components/ListToolbar'
import { RowActions } from '@/screens/doctype/components/RowActions'
import { SavedViewMenu } from '@/screens/doctype/components/SavedViewMenu'
import { ViewMenu } from '@/screens/doctype/components/ViewMenu'
import { DeleteRecordDialog } from '@/screens/doctype/form/DeleteRecordDialog'
import { useBulkDeleteDocs, useDeleteDoc } from '@/screens/doctype/hooks/use-doctype-mutations'
import { useDocCount, useDocList, useDoctypeSchema } from '@/screens/doctype/hooks/use-doctype'
import { useDoctypeRoute } from '@/screens/doctype/hooks/use-doctype-route'
import { useListExport } from '@/screens/doctype/hooks/use-list-export'
import { useListState } from '@/screens/doctype/hooks/use-list-state'
import { useSavedViews } from '@/screens/doctype/hooks/use-saved-views'
import { ActiveFilters } from '@/screens/doctype/components/ActiveFilters'
import { ColumnFilterMenu } from '@/screens/doctype/components/column-filters/ColumnFilterMenu'
import { DoctypeLinkContext, useDoctypeLinkIndex } from '@/screens/doctype/lib/doctype-links'
import { isFilterableField } from '@/screens/doctype/lib/fields'
import { toFrappeFilter } from '@/screens/doctype/lib/filters'
import { screenOverride } from '@/screens/doctype/registry'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { ScreenNotFound } from '@/shared/components/feedback/ScreenNotFound'
import { PageFrame } from '@/shared/components/layout/PageFrame'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { useBrandedDocument, useInstitutionBranding } from '@/shared/hooks/use-branding'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Spinner } from '@/shared/ui/spinner'
import type { DocRow, DoctypeSchema, SchemaField } from '@/screens/doctype/types'

/**
 * Every doctype's list, rendered from `get_doctype_schema`.
 *
 * One page for all fourteen screens. The columns, filters, searchable fields and default sort
 * are all authored in the doctype JSON already (`in_list_view`, `in_standard_filter`,
 * `search_fields`, `sort_field`) — this reads them rather than restating them in TypeScript,
 * which is the same call `navigation.py` makes for the menu itself.
 *
 * Rows come from `/api/resource/<doctype>` through the SDK, so the framework's permissions
 * apply unchanged; the schema endpoint returns no data of its own.
 *
 * A module may replace this page wholesale through `registry.ts` — see the rule at the top of
 * that file. The route, the shell and the auth gate are unchanged when it does.
 */
export default function DoctypeListPage() {
  const route = useDoctypeRoute()
  const { data: brand } = useInstitutionBranding()
  const schemaQuery = useDoctypeSchema(route.doctype)
  const override = screenOverride(route.doctype)

  useBrandedDocument(route.screenLabel ?? 'Records', brand?.institution ?? null)

  if (route.status === 'pending' || (route.status === 'ready' && schemaQuery.isPending)) {
    return <ListSkeleton />
  }

  if (route.status === 'unknown-module') {
    return (
      <ScreenNotFound thing="Module" body="There is no module at this address, or it is not one of yours." />
    )
  }

  if (route.status === 'unknown-doctype') {
    return <ScreenNotFound />
  }

  if (schemaQuery.isError) {
    return (
      <PageFrame>
        <PageHeader title={route.screenLabel ?? 'Records'} crumbs={crumbsFor(route)} />
        <div className="mt-8">
          <ErrorState
            error={schemaQuery.error}
            title="Screen unavailable"
            onRetry={() => void schemaQuery.refetch()}
          />
        </div>
      </PageFrame>
    )
  }

  // Narrows `data` off the query union: the compound guard above satisfies a reader but not
  // the type checker, and asserting would hide a real "resolved but still empty" case.
  if (!schemaQuery.data) return <ListSkeleton />

  // Level 3 override: a whole page, still inside RequireAuth → AppShell on this route.
  if (override.ListScreen) {
    const Screen = override.ListScreen
    return <Screen />
  }

  // Keyed on the doctype so switching screens remounts rather than carrying the previous
  // screen's sort field into a schema that has no such column.
  return <ListBody key={route.doctype} schema={schemaQuery.data} route={route} />
}

function crumbsFor(route: ReturnType<typeof useDoctypeRoute>) {
  return [
    { label: route.moduleLabel ?? 'Module', to: route.modulePath },
    { label: route.screenLabel ?? 'Records' },
  ]
}

function ListBody({ schema, route }: { schema: DoctypeSchema; route: ReturnType<typeof useDoctypeRoute> }) {
  const defaultSort = useMemo(
    () => ({ field: schema.sort_field, order: schema.sort_order }),
    [schema.sort_field, schema.sort_order],
  )
  const state = useListState()
  // The search box updates the URL on every keystroke (so the link stays shareable) but only
  // reaches the server once typing pauses.
  const search = useDebouncedValue(state.search, 250)
  const linkIndex = useDoctypeLinkIndex()
  const savedViews = useSavedViews(schema.doctype)
  const override = screenOverride(schema.doctype)

  const byName = useMemo(
    () => new Map(schema.fields.map((field) => [field.fieldname, field])),
    [schema.fields],
  )

  const allColumns = useMemo(
    () =>
      schema.list_columns
        .map((fieldname) => byName.get(fieldname) ?? syntheticNameField(fieldname))
        .filter((field): field is SchemaField => !!field),
    [schema.list_columns, byName],
  )

  // The identity column is never hideable — it is the row's only link to its record.
  const columns = useMemo(
    () => allColumns.filter((field, index) => index === 0 || !state.hiddenColumns.has(field.fieldname)),
    [allColumns, state.hiddenColumns],
  )

  const filterFields = useMemo(
    () =>
      schema.filter_fields
        .map((fieldname) => byName.get(fieldname))
        .filter((field): field is SchemaField => !!field && isFilterableField(field)),
    [schema.filter_fields, byName],
  )

  // Both filter channels become one ANDed `Filter[]`. Only fields the schema still has — a stale
  // URL param from another screen must not reach the server as a column that does not exist.
  // Column filters are ANDed too, so `get_count` sees them and the total stays honest; only the
  // OR-fanned search hides the count.
  const filters = useMemo<Filter[]>(() => {
    const flat: Filter[] = Object.entries(state.filters)
      .filter(([fieldname]) => byName.has(fieldname))
      .map(([fieldname, value]) => {
        const field = byName.get(fieldname)!
        return [fieldname, '=', field.fieldtype === 'Check' ? Number(value) : value] as Filter
      })

    const typed: Filter[] = state.columnFilters
      .filter((filter) => byName.has(filter.field))
      .map(toFrappeFilter)
      .filter((filter): filter is Filter => filter !== null)

    return [...flat, ...typed]
  }, [state.filters, state.columnFilters, byName])

  const query = {
    // Always the full authored set, not the visible subset: hiding a column is a display
    // choice, and refetching every row because someone toggled one off would make the table
    // blink for nothing.
    fields: schema.list_columns,
    filters,
    search,
    searchFields: schema.search_fields,
    // The doctype's authored order, always. The grid re-sorts client-side, so this decides
    // only *which* rows the cap keeps when a doctype overflows it — and "the first 2000 by the
    // order the doctype considers natural" is the one answer that is defensible.
    sort: [defaultSort],
    page: 1,
    pageSize: LIST_ROW_CAP,
  }

  const list = useDocList(schema.doctype, query)
  // Skipped while searching: get_count cannot see or_filters, so its answer would be the
  // unsearched total — a number that looks authoritative and is wrong.
  const isSearching = !!search.trim()
  const count = useDocCount(schema.doctype, filters, !isSearching)

  const rows = list.data
  const label = route.screenLabel ?? schema.label
  // The cap is a ceiling on the fetch, so hitting it exactly is how truncation announces
  // itself. Saying so matters more here than it did under server paging: a short list that
  // looks complete is the failure mode of loading everything into the browser.
  const truncated = !!rows && rows.length >= LIST_ROW_CAP

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  // Two delete dialogs would be two components; one dialog with a target is one. `null` means
  // closed, a row means "delete this one", 'bulk' means "delete the selection".
  const [deleteTarget, setDeleteTarget] = useState<DocRow | 'bulk' | null>(null)
  const removeOne = useDeleteDoc(schema.doctype)
  const removeMany = useBulkDeleteDocs(schema.doctype)

  const { exportRows, isExporting } = useListExport({
    doctype: schema.doctype,
    label,
    columns,
    query,
  })

  const toggleRow = useCallback((name: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      const names = rows?.map((row) => row.name) ?? []
      setSelected((prev) => {
        const next = new Set(prev)
        for (const name of names) {
          if (checked) next.add(name)
          else next.delete(name)
        }
        return next
      })
    },
    [rows],
  )

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  function confirmDelete() {
    if (deleteTarget === null) return

    if (deleteTarget === 'bulk') {
      removeMany.mutate([...selected], {
        onSuccess: ({ deleted, failed }) => {
          setDeleteTarget(null)
          // Selection is narrowed to what survived rather than cleared, so the rows that
          // refused stay picked and the reason stays actionable.
          setSelected(new Set(failed.map((entry) => entry.name)))

          if (deleted.length) toast.success(`Deleted ${deleted.length} ${label.toLowerCase()}.`)
          if (failed.length) {
            // The first reason, and a count. Ten toasts for ten linked records is a wall; the
            // reason is almost always the same one, and the rows are still selected.
            toast.error(
              failed.length === 1
                ? failed[0].message
                : `${failed.length} could not be deleted. ${failed[0].message}`,
            )
          }
        },
      })
      return
    }

    const row = deleteTarget
    removeOne.mutate(row.name, {
      onSuccess: () => {
        setDeleteTarget(null)
        toast.success(`${row[schema.title_field] ?? row.name} deleted.`)
      },
      onError: (error) => {
        setDeleteTarget(null)
        toast.error(normalizeFrappeError(error).message)
      },
    })
  }

  const HeaderActions = override.slots?.listHeaderActions

  return (
    <DoctypeLinkContext value={linkIndex}>
      <PageFrame>
        <PageHeader
          title={label}
          count={isSearching ? undefined : count.data}
          crumbs={crumbsFor(route)}
          actions={
            <>
              {HeaderActions && <HeaderActions doctype={schema.doctype} />}
              {schema.permissions.can_create && (
                <Button asChild className="h-10">
                  <Link to={`${route.listPath}/new`}>
                    <PlusIcon aria-hidden="true" />
                    New {label.toLowerCase()}
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {/* One elevated surface: the toolbar is the table's own chrome, the pagination its
            footer. Search and filters, the rows, and the range control read as one object rather
            than three stacked boxes with gaps between them. */}
        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="flex flex-col gap-2.5 border-b border-border p-2.5">
            <ListToolbar
              search={state.search}
              onSearchChange={state.setSearch}
              searchPlaceholder={searchPlaceholder(schema, byName)}
              filterFields={filterFields}
              filters={state.filters}
              onFilterChange={state.setFilter}
              onClear={state.clearFilters}
              hasFilters={state.hasFilters}
              actions={
                <>
                  <SavedViewMenu state={savedViews} />
                  <ColumnFilterMenu
                    fields={allColumns}
                    active={state.columnFilters}
                    onChange={state.setColumnFilter}
                    onRemove={state.removeColumnFilter}
                  />
                  {/* No `onResetWidths`: column widths are the engine's own resizing state now
                      and it reports none of it back, so there is nothing stored to reset. */}
                  <ViewMenu
                    columns={allColumns}
                    hiddenColumns={state.hiddenColumns}
                    onToggleColumn={state.toggleColumn}
                    density={state.density}
                    onDensityChange={state.setDensity}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => void exportRows()}
                    disabled={isExporting || !rows?.length}
                  >
                    {isExporting ? <Spinner className="size-4" /> : <DownloadIcon aria-hidden="true" />}
                    Export
                  </Button>
                </>
              }
            />

            <ActiveFilters
              flatFilters={state.filters}
              columnFilters={state.columnFilters}
              fieldsByName={byName}
              onRemoveFlat={(field) => state.setFilter(field, '')}
              onRemoveColumn={state.removeColumnFilter}
              onClearAll={state.clearFilters}
            />
          </div>

          {selected.size > 0 && (
            <div className="border-b border-border">
              <BulkBar
                count={selected.size}
                onExport={() => void exportRows([...selected])}
                onDelete={schema.permissions.can_delete ? () => setDeleteTarget('bulk') : undefined}
                onClear={clearSelection}
                isExporting={isExporting}
                isDeleting={removeMany.isPending}
              />
            </div>
          )}

          {list.isError ? (
            <div className="p-3">
              <ErrorState
                error={list.error}
                title="Records unavailable"
                onRetry={() => void list.refetch()}
              />
            </div>
          ) : list.isPending || !rows ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            // Two different emptinesses. "No records yet" beside an active filter is a lie, and
            // it sends someone off to create a record that already exists.
            <div className="p-3">
              {state.hasFilters ? (
                <EmptyState
                  title="No matches"
                  body="No records match the current search and filters."
                  action={
                    <Button className="h-10" onClick={state.clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title={`No ${label.toLowerCase()} yet`}
                  body={
                    schema.permissions.can_create
                      ? `Nothing has been recorded here yet. Add the first one to get started.`
                      : `Nothing has been recorded here yet, and your account cannot add one.`
                  }
                  action={
                    schema.permissions.can_create ? (
                      <Button asChild className="h-10">
                        <Link to={`${route.listPath}/new`}>
                          <PlusIcon aria-hidden="true" />
                          New {label.toLowerCase()}
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : (
            <>
              {truncated && (
                <p
                  role="status"
                  className="border-b border-border bg-warning/10 px-3 py-2 text-xs text-foreground"
                >
                  Showing the first {LIST_ROW_CAP.toLocaleString()} {label.toLowerCase()}
                  {count.data ? ` of ${count.data.toLocaleString()}` : ''}. Narrow the search or filters to
                  see the rest.
                </p>
              )}

              <DoctypeGrid
                doctype={schema.doctype}
                columns={columns}
                rows={rows}
                label={label}
                rowPath={(row) => `${route.listPath}/${encodeURIComponent(row.name)}`}
                density={state.density}
                defaultSort={defaultSort}
                activeFilters={state.columnFilters}
                selection={{
                  selected,
                  onToggle: toggleRow,
                  onToggleAll: toggleAll,
                }}
                rowActions={(row) => (
                  <RowActions
                    href={`${route.listPath}/${encodeURIComponent(row.name)}`}
                    subject={String(row[schema.title_field] ?? row.name)}
                    canWrite={schema.permissions.can_write}
                    canDelete={schema.permissions.can_delete}
                    onDelete={() => setDeleteTarget(row)}
                  />
                )}
              />
            </>
          )}
        </section>

        <DeleteRecordDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          subject={
            deleteTarget === 'bulk'
              ? `${selected.size} ${label.toLowerCase()}`
              : String(deleteTarget?.[schema.title_field] ?? deleteTarget?.name ?? '')
          }
          isPending={removeOne.isPending || removeMany.isPending}
          onConfirm={confirmDelete}
        />
      </PageFrame>
    </DoctypeLinkContext>
  )
}

/**
 * `name` is not a DocField, but it is a legitimate list column — every doctype named by a
 * series (`Admission Gate Pass`) has it as its identity. Synthesised so the table can render it
 * like any other.
 */
function syntheticNameField(fieldname: string): SchemaField | null {
  if (fieldname !== 'name') return null
  return {
    fieldname: 'name',
    fieldtype: 'Data',
    label: 'ID',
    options: null,
    default: null,
    description: null,
    reqd: 1,
    read_only: 1,
    hidden: 0,
    unique: 1,
    precision: null,
    length: 0,
    fetch_from: null,
    non_negative: 0,
    in_list_view: 1,
    in_standard_filter: 0,
    depends_on: null,
    mandatory_depends_on: null,
    link_filters: null,
  }
}

/**
 * Name what the search box actually searches.
 *
 * Fieldnames that do not resolve to a labelled field are dropped rather than printed raw —
 * `search_fields` is an authored string that can name a field this user cannot read, or one
 * that has since been renamed, and "Search college name, short_name, college code" in front of
 * a user is worse than naming one field fewer.
 */
function searchPlaceholder(schema: DoctypeSchema, byName: Map<string, SchemaField>): string {
  const labels = schema.search_fields
    .filter((fieldname) => fieldname !== 'name')
    .map((fieldname) => byName.get(fieldname)?.label)
    .filter((label): label is string => !!label)
    .slice(0, 3)

  return labels.length ? `Search ${labels.join(', ').toLowerCase()}` : 'Search'
}

/**
 * The rows, while they load.
 *
 * Inside the card rather than replacing it: the toolbar above is already interactive and
 * swapping the whole surface for a skeleton would take the search box away from someone
 * mid-type. Ten rows regardless of page size — the grid paginates client-side now, so the
 * page size is not known until the rows are.
 */
function TableSkeleton() {
  return (
    <div className="p-3" role="status" aria-live="polite">
      {Array.from({ length: 10 }).map((_, index) => (
        <Skeleton key={index} className="mb-3 h-5 w-full last:mb-0" />
      ))}
      <span className="sr-only">Loading records</span>
    </div>
  )
}

function ListSkeleton() {
  return (
    <PageFrame>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-6 h-8 w-full max-w-sm" />
      <div
        className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card"
        role="status"
        aria-live="polite"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-4 w-full last:mb-0" />
        ))}
        <span className="sr-only">Loading records</span>
      </div>
    </PageFrame>
  )
}
