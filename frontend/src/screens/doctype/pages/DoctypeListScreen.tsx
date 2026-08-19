import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { DoctypeTable, LIST_ROW_CAP } from '@/screens/doctype/components/DoctypeTable'
import { StatusViews } from '@/screens/doctype/components/StatusViews'
import { DeleteRecordDialog } from '@/screens/doctype/form/DeleteRecordDialog'
import { useDeleteDoc } from '@/screens/doctype/hooks/use-doctype-mutations'
import { useDocCount, useDocList, useDoctypeSchema } from '@/screens/doctype/hooks/use-doctype'
import { useDoctypeRoute } from '@/screens/doctype/hooks/use-doctype-route'
import { DoctypeLinkContext, useDoctypeLinkIndex } from '@/screens/doctype/lib/doctype-links'
import { screenOverride } from '@/screens/doctype/registry'
import { STATUS_PARAM, statusOptions, statusViewField } from '@/screens/doctype/lib/status'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { ScreenNotFound } from '@/shared/components/feedback/ScreenNotFound'
import { PageFrame } from '@/shared/components/layout/PageFrame'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { useBrandedDocument, useInstitutionBranding } from '@/shared/hooks/use-branding'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import type { Filter } from 'frappe-js-sdk/lib/db/types'

import type { DocRow, DoctypeSchema, SchemaField } from '@/screens/doctype/types'

/**
 * Every doctype's list, rendered from `get_doctype_schema`.
 *
 * One page for every screen. The columns, searchable fields and default sort are all authored in
 * the doctype JSON (`in_list_view`, `sort_field`) — this reads them rather than restating them.
 *
 * The table itself is the stock `@bloomskill/table-shadcn` component ({@link DoctypeTable}): its
 * own toolbar owns search, column filters, the columns menu, sorting, pagination, density and
 * export. This page's job is narrower — fetch the rows (permissions applied by the framework),
 * seed the table, and own the record-level actions (create, delete) that live outside a table.
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

  if (!schemaQuery.data) return <ListSkeleton />

  // Level 3 override: a whole page, still inside RequireAuth → AppShell on this route.
  if (override.ListScreen) {
    const Screen = override.ListScreen
    return <Screen />
  }

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
  const linkIndex = useDoctypeLinkIndex()
  const override = screenOverride(schema.doctype)
  const [searchParams] = useSearchParams()

  // The status views. `null` is "All"; an unknown word in the URL is ignored rather than sent
  // to the server, so a stale or hand-edited link lands on the full list instead of an empty
  // one that looks like a permission problem.
  const statusField = useMemo(() => statusViewField(schema.fields), [schema.fields])
  const requestedStatus = searchParams.get(STATUS_PARAM)
  const activeStatus =
    statusField && requestedStatus && statusOptions(statusField).includes(requestedStatus)
      ? requestedStatus
      : null

  // The one filter the app still owns. Everything else in the toolbar narrows rows already
  // fetched; this narrows what the server selects, which is what makes it meaningful against
  // the 2000-row cap.
  const filters = useMemo<Filter[]>(
    () => (statusField && activeStatus ? [[statusField.fieldname, '=', activeStatus]] : []),
    [statusField, activeStatus],
  )

  const byName = useMemo(
    () => new Map(schema.fields.map((field) => [field.fieldname, field])),
    [schema.fields],
  )

  // Every authored list column, in order. Hiding is the table's own columns menu now (seeded by
  // the registry override); the fetch always asks for the full set so toggling a column back on
  // never needs a round trip.
  const columns = useMemo(
    () =>
      schema.list_columns
        .map((fieldname) => byName.get(fieldname) ?? syntheticNameField(fieldname))
        .filter((field): field is SchemaField => !!field),
    [schema.list_columns, byName],
  )

  // The engine sorts / searches / paginates in memory, so the page loads rows up to the cap and
  // narrows the fetch by the doctype's natural order — "the first 2000" is the defensible answer
  // when a doctype overflows the browser.
  const query = {
    fields: schema.list_columns,
    filters,
    search: '',
    searchFields: [],
    sort: [defaultSort],
    page: 1,
    pageSize: LIST_ROW_CAP,
  }

  const list = useDocList(schema.doctype, query)
  const count = useDocCount(schema.doctype, filters)

  const rows = list.data
  const label = route.screenLabel ?? schema.label
  const truncated = !!rows && rows.length >= LIST_ROW_CAP

  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null)
  const removeOne = useDeleteDoc(schema.doctype)

  function confirmDelete() {
    if (!deleteTarget) return
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
          count={count.data}
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

        {statusField && (
          <div className="mt-5 border-b border-border">
            <StatusViews doctype={schema.doctype} field={statusField} active={activeStatus} />
          </div>
        )}

        <div className={statusField ? 'mt-4' : 'mt-6'}>
          {list.isError ? (
            <ErrorState error={list.error} title="Records unavailable" onRetry={() => void list.refetch()} />
          ) : list.isPending || !rows ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            // "Nothing matches this view" and "nothing exists yet" are different answers, and
            // offering "add the first one" under a status filter invites a record that would
            // not appear in the view that just invited it.
            activeStatus ? (
              <EmptyState
                title={`No ${label.toLowerCase()} in ${activeStatus}`}
                body={`Nothing currently has this status. Other ${label.toLowerCase()} may be in another view.`}
                action={
                  <Button asChild variant="outline" className="h-10">
                    <Link to={route.listPath}>Show all {label.toLowerCase()}</Link>
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
            )
          ) : (
            <>
              {truncated && (
                <p
                  role="status"
                  className="mb-3 rounded-lg border border-border bg-warning/10 px-3 py-2 text-xs text-foreground"
                >
                  Showing the first {LIST_ROW_CAP.toLocaleString()} {label.toLowerCase()}
                  {count.data ? ` of ${count.data.toLocaleString()}` : ''}. Filter to narrow the set.
                </p>
              )}

              <DoctypeTable
                doctype={schema.doctype}
                columns={columns}
                rows={rows}
                label={label}
                rowPath={(row) => `${route.listPath}/${encodeURIComponent(row.name)}`}
                defaultSort={defaultSort}
                hiddenColumns={override.list?.hiddenColumns}
                titleField={schema.title_field}
                canWrite={schema.permissions.can_write}
                canDelete={schema.permissions.can_delete}
                onDelete={setDeleteTarget}
              />
            </>
          )}
        </div>

        <DeleteRecordDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          subject={String(deleteTarget?.[schema.title_field] ?? deleteTarget?.name ?? '')}
          isPending={removeOne.isPending}
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
 * The rows, while they load. Ten rows regardless of page size — the grid paginates client-side,
 * so the page size is not known until the rows are.
 */
function TableSkeleton() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 shadow-card"
      role="status"
      aria-live="polite"
    >
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
      <div
        className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card"
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
