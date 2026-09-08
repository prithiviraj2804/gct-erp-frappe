import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { DoctypeTable, LIST_ROW_CAP } from '@/pages/doctype/components/DoctypeTable'
import { StatusFilter } from '@/pages/doctype/components/StatusFilter'
import { DeleteRecordDialog } from '@/pages/doctype/form/DeleteRecordDialog'
import { useDeleteDoc } from '@/pages/doctype/hooks/use-doctype-mutations'
import { useDocCount, useDocList, useDoctypeSchema } from '@/pages/doctype/hooks/use-doctype'
import { useDoctypeRoute } from '@/pages/doctype/hooks/use-doctype-route'
import { DoctypeLinkContext, useDoctypeLinkIndex } from '@/pages/doctype/lib/doctype-links'
import { screenOverride } from '@/pages/doctype/registry'
import { STATUS_PARAM, statusOptions, statusViewField } from '@/pages/doctype/lib/status'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ScreenNotFound } from '@/components/feedback/ScreenNotFound'
import { PageFrame } from '@/components/layout/PageFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { useBrandedDocument, useInstitutionBranding } from '@/hooks/use-branding'
import { normalizeFrappeError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Filter } from 'frappe-js-sdk/lib/db/types'

import type { DocRow, DoctypeSchema, SchemaField } from '@/pages/doctype/types'

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
        <div className="mt-(--page-stack)">
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
          // The one thing the header still says about the data, and only when it is not the
          // whole truth. It was a warning-tinted banner of its own above the table — a whole
          // horizontal band for one sentence — and it needs no coloured box to be read, because
          // it is the only line under the title.
          //
          // `count` survives the header's count removal purely for this: the sentence is
          // meaningless without the total it is a fraction of.
          note={
            truncated ? (
              <>
                showing the first {LIST_ROW_CAP.toLocaleString()}
                {count.data ? ` of ${count.data.toLocaleString()}` : ''} — narrow the list to see
                the rest
              </>
            ) : undefined
          }
          crumbs={crumbsFor(route)}
          actions={
            <>
              {HeaderActions && <HeaderActions doctype={schema.doctype} />}
              {/* The status scope sits with the page's other action rather than in a band of its
                  own. It is a PAGE-level filter — it changes what the server returns — which is
                  why it is not folded into the table's toolbar beside the filters that only
                  narrow rows already fetched. See StatusFilter. */}
              {statusField && <StatusFilter doctype={schema.doctype} field={statusField} />}
              {schema.permissions.can_create && (
                <Button asChild className="h-10">
                  <Link to={`${route.listPath}/new`}>
                    <PlusIcon aria-hidden="true" />
                    New {label}
                  </Link>
                </Button>
              )}
            </>
          }
        />

        <div className="mt-(--page-stack)">
          {list.isError ? (
            <ErrorState error={list.error} title="Records unavailable" onRetry={() => void list.refetch()} />
          ) : list.isPending || !rows ? (
            <TableCardSkeleton />
          ) : rows.length === 0 ? (
            // "Nothing matches this view" and "nothing exists yet" are different answers, and
            // offering "add the first one" under a status filter invites a record that would
            // not appear in the view that just invited it.
            activeStatus ? (
              <EmptyState
                title={`No ${label} records in ${activeStatus}`}
                body={`No ${label} records currently have this status. Others may be in another view.`}
                action={
                  <Button asChild variant="outline" className="h-10">
                    {/* Clears the scope by dropping the parameter — the Select in the header
                        reads the URL, so this and it can never disagree. */}
                    <Link to={route.listPath}>Clear the {activeStatus} filter</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={`No ${label} records yet`}
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
                        New {label}
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
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

const SKELETON_ROWS = 8

/**
 * The grid, while it loads — the same card for both loading phases, shaped like the thing it
 * replaces: toolbar band, header strip, rows, footer band.
 *
 * A skeleton that is the wrong size is worse than none, and this page used to show three
 * different layouts per load (a bare 8-line card, then a 10-line one at a different padding,
 * then the real grid with a toolbar and footer neither had drawn).
 *
 * The band paddings are fixed utilities deliberately: they are the package's own chrome and do
 * not move with density. Only the row band takes `--table-cell-pad-y`, which is what makes a
 * compact skeleton the height of a compact grid — 6+6+28 comfortable, 2+2+28 compact, from the
 * token rather than a literal. `rounded-2xl` because `.sc-card` draws `calc(--radius + 2px)`.
 */
function TableCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="ml-auto h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex h-9.5 items-center gap-4 border-b border-border bg-table-header px-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-3 py-(--table-cell-pad-y)"
        >
          <Skeleton className="h-7 w-full" />
        </div>
      ))}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="ml-auto h-8 w-40" />
      </div>
      <span className="sr-only">Loading records</span>
    </div>
  )
}

/**
 * The whole page, before the schema is known — so it draws the header too.
 *
 * The title bar is `h-10` and the title itself `h-5`: the header's real height is set by the New
 * button, not by the 20px title, and drawing a 40px title slab is what used to make the body
 * jump when the real header arrived. No meta-line placeholder: `note` is passed only when the
 * list is truncated, so a permanent bar here would manufacture the reflow it exists to prevent.
 */
function ListSkeleton() {
  return (
    <PageFrame>
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="flex h-10 items-center justify-between gap-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="mt-(--page-stack)">
        <TableCardSkeleton />
      </div>
    </PageFrame>
  )
}
