import { ChevronDownIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { CELL_RENDERERS } from '@/screens/doctype/components/cell-renderers'
import { FallbackCell } from '@/screens/doctype/components/cells'
import { ChildTable } from '@/screens/doctype/components/ChildTable'
import { RecordFrame, RecordSkeleton } from '@/screens/doctype/components/RecordFrame'
import { RecordSummary } from '@/screens/doctype/components/RecordSummary'
import { DeleteRecordDialog } from '@/screens/doctype/form/DeleteRecordDialog'
import { DoctypeEditor } from '@/screens/doctype/form/DoctypeEditor'
import { useDeleteDoc } from '@/screens/doctype/hooks/use-doctype-mutations'
import { useDoc, useDoctypeSchema } from '@/screens/doctype/hooks/use-doctype'
import { useDoctypeRoute } from '@/screens/doctype/hooks/use-doctype-route'
import { DoctypeLinkContext, useDoctypeLinkIndex } from '@/screens/doctype/lib/doctype-links'
import { evalCondition } from '@/screens/doctype/lib/expressions'
import { CHILD_TABLE_TYPES, FULL_WIDTH_TYPES, isSummarisable } from '@/screens/doctype/lib/fields'
import { statusTone, TONE_DOT_CLASS } from '@/screens/doctype/lib/status'
import { screenOverride, type ScreenOverride } from '@/screens/doctype/registry'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { Button } from '@/shared/ui/button'
import { ScreenNotFound } from '@/shared/components/feedback/ScreenNotFound'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { useBrandedDocument, useInstitutionBranding } from '@/shared/hooks/use-branding'
import { cn } from '@/shared/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { DocRecord, DoctypeSchema, SchemaField, SchemaSection, SchemaTab } from '@/screens/doctype/types'

/**
 * One record, read-only, laid out the way its doctype authored it.
 *
 * Tabs, sections and columns all come from `layout`, so a form's structure in Desk and its
 * structure here cannot drift. Values render through the same cell components the table uses —
 * an email is mailable and a Link is openable in both places without either surface deciding
 * that separately.
 *
 * Above the authored form sit two things the schema cannot supply: the record's state, lifted
 * into the header, and a four-fact summary strip. Both are named in `registry.ts` per module,
 * with defaults that are defensible rather than clever.
 *
 * Editing is not in this phase. Every field is shown; none is writable.
 */
export default function DoctypeRecordPage() {
  const route = useDoctypeRoute()
  const { name = '' } = useParams()
  const { data: brand } = useInstitutionBranding()
  const override = screenOverride(route.doctype)

  // Fired in parallel, never gated on each other: a record page needs both, and chaining them
  // would serialise two round-trips on the critical path of every screen.
  const schemaQuery = useDoctypeSchema(route.doctype)
  const docQuery = useDoc(route.doctype, name || null)
  const linkIndex = useDoctypeLinkIndex()

  const title = titleOf(docQuery.data, schemaQuery.data) ?? name
  useBrandedDocument(title, brand?.institution ?? null)

  if (route.status === 'pending' || (route.status === 'ready' && schemaQuery.isPending)) {
    return <RecordSkeleton />
  }

  if (route.status === 'unknown-module') {
    return (
      <ScreenNotFound thing="Module" body="There is no module at this address, or it is not one of yours." />
    )
  }

  if (route.status === 'unknown-doctype') {
    return <ScreenNotFound />
  }

  const crumbs = [
    { label: route.moduleLabel ?? 'Module', to: route.modulePath },
    { label: route.screenLabel ?? 'Records', to: route.listPath },
    { label: title },
  ]

  if (schemaQuery.isError || docQuery.isError) {
    const failed = schemaQuery.isError ? schemaQuery : docQuery
    return (
      <RecordFrame>
        <PageHeader title={name} crumbs={crumbs} />
        <div className="mt-8">
          <ErrorState
            error={failed.error}
            // A deleted or misspelt record is a 404 from Frappe and by far the likeliest cause,
            // so the copy names it rather than implying the system is broken.
            title="Record unavailable"
            onRetry={() => void failed.refetch()}
          />
        </div>
      </RecordFrame>
    )
  }

  // Level 3 override: a task screen rather than a record screen, on the same route.
  if (override.RecordScreen) {
    const Screen = override.RecordScreen
    return <Screen />
  }

  // Same narrowing note as the list page — the guards above do not reach the query union.
  if (docQuery.isPending || !docQuery.data || !schemaQuery.data) return <RecordSkeleton />

  return (
    <DoctypeLinkContext value={linkIndex}>
      <RecordBody
        schema={schemaQuery.data}
        doc={docQuery.data}
        title={title}
        crumbs={crumbs}
        override={override}
        listPath={route.listPath}
        label={route.screenLabel ?? schemaQuery.data.label}
      />
    </DoctypeLinkContext>
  )
}

function RecordBody({
  schema,
  doc,
  title,
  crumbs,
  override,
  listPath,
  label,
}: {
  schema: DoctypeSchema
  doc: DocRecord
  title: string
  crumbs: { label: string; to?: string }[]
  override: ScreenOverride
  listPath: string
  label: string
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useDeleteDoc(schema.doctype)

  // Edit mode lives in the URL, like every other piece of screen state here: it survives a
  // reload, it is a link someone can send ("open this and fix the code"), and Back leaves the
  // form instead of leaving the record.
  const editing = params.get('edit') === '1' && schema.permissions.can_write

  const setEditing = (next: boolean) =>
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev)
        if (next) updated.set('edit', '1')
        else updated.delete('edit')
        return updated
      },
      { replace: true },
    )
  const byName = useMemo(
    () => new Map(schema.fields.map((field) => [field.fieldname, field])),
    [schema.fields],
  )

  const statusFieldname = override.record?.statusField ?? 'status'
  const statusField = byName.get(statusFieldname)
  const statusValue = statusField ? doc[statusFieldname] : undefined

  const summaryFields = useMemo(
    () => resolveSummaryFields(schema, byName, doc, override, statusFieldname),
    [schema, byName, doc, override, statusFieldname],
  )

  const tabs = schema.layout
  const [activeTab, setActiveTab] = useState(() => tabKey(tabs[0], 0))
  const HeaderActions = override.slots?.recordHeaderActions

  const header = (
    <>
      <PageHeader
        title={title}
        subtitle={subtitleOf(doc, schema)}
        crumbs={crumbs}
        actions={
          <>
            {statusField && typeof statusValue === 'string' && statusValue && (
              <StatusPill value={statusValue} doctype={schema.doctype} />
            )}
            {HeaderActions && <HeaderActions doctype={schema.doctype} name={doc.name} />}
            {/* Hidden while editing: the form has its own Save/Cancel bar, and a second set of
                actions in the header is two answers to "how do I finish?". */}
            {!editing && schema.permissions.can_write && (
              <Button variant="outline" className="h-10" onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden="true" />
                Edit
              </Button>
            )}
            {!editing && schema.permissions.can_delete && (
              <Button variant="destructive" className="h-10" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon aria-hidden="true" />
                Delete
              </Button>
            )}
          </>
        }
      />
      {summaryFields.length > 0 && (
        <div className="mt-6">
          <RecordSummary fields={summaryFields} doc={doc} doctype={schema.doctype} />
        </div>
      )}
    </>
  )

  const deleteDialog = (
    <DeleteRecordDialog
      open={confirmDelete}
      onOpenChange={setConfirmDelete}
      subject={title}
      isPending={remove.isPending}
      onConfirm={() =>
        remove.mutate(doc.name, {
          onSuccess: () => {
            setConfirmDelete(false)
            toast.success(`${title} deleted.`)
            // `replace`, so Back does not return to a record that no longer exists.
            void navigate(listPath, { replace: true })
          },
          onError: (error) => {
            setConfirmDelete(false)
            // Almost always "cannot be deleted because it is linked with ..." — a real answer
            // the user can act on, and the reason the delete button does not promise success.
            toast.error(normalizeFrappeError(error).message)
          },
        })
      }
    />
  )

  if (editing) {
    return (
      <RecordFrame>
        {header}
        <div className="mt-6">
          <DoctypeEditor
            schema={schema}
            doc={doc}
            listPath={listPath}
            label={label}
            onDone={() => setEditing(false)}
          />
        </div>
      </RecordFrame>
    )
  }

  // One tab is the common case — every doctype in this app today — and a tab strip over a
  // single tab is chrome that answers no question.
  if (tabs.length <= 1) {
    return (
      <RecordFrame>
        {header}
        <div className="mt-6 flex flex-col gap-6">
          {(tabs[0]?.sections ?? []).map((section, index) => (
            <RecordSection
              key={section.label ?? `section-${index}`}
              section={section}
              schema={schema}
              byName={byName}
              doc={doc}
            />
          ))}
        </div>
        {deleteDialog}
      </RecordFrame>
    )
  }

  return (
    <RecordFrame>
      {header}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 gap-6">
        <TabsList>
          {tabs.map((tab, index) => (
            <TabsTrigger key={tabKey(tab, index)} value={tabKey(tab, index)}>
              {tab.label ?? 'Details'}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab, index) => (
          <TabsContent key={tabKey(tab, index)} value={tabKey(tab, index)} className="flex flex-col gap-6">
            {tab.sections.map((section, sectionIndex) => (
              <RecordSection
                key={section.label ?? `section-${sectionIndex}`}
                section={section}
                schema={schema}
                byName={byName}
                doc={doc}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
      {deleteDialog}
    </RecordFrame>
  )
}

/** Stable across renders and unique even when two tabs share a label (or have none). */
function tabKey(tab: SchemaTab | undefined, index: number): string {
  return `${index}-${tab?.label ?? 'details'}`
}

function StatusPill({ value, doctype }: { value: string; doctype: string }) {
  const tone = statusTone(value, screenOverride(doctype).statusTones)
  return (
    <span
      data-slot="record-status"
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', TONE_DOT_CLASS[tone])} />
      {value}
    </span>
  )
}

/** Static class strings, so Tailwind's scanner can see every one it may need to emit. */
const COLUMN_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

function RecordSection({
  section,
  schema,
  byName,
  doc,
}: {
  section: SchemaSection
  schema: DoctypeSchema
  byName: Map<string, SchemaField>
  doc: DocRecord
}) {
  // `depends_on` is visibility. A hidden field on a read-only page is one the record does not
  // use — showing "Vehicle Number: —" on a pass with no vehicle is noise that reads as missing
  // data. Resolved per column so an emptied column collapses rather than leaving a gap.
  const columns = section.columns
    .map((column) =>
      column
        .map((fieldname) => byName.get(fieldname))
        .filter((field): field is SchemaField => !!field)
        .filter((field) => evalCondition(field.depends_on, doc)),
    )
    .filter((column) => column.length > 0)

  if (columns.length === 0) return null

  const body = (
    <div className={cn('grid gap-x-8 gap-y-4', COLUMN_GRID[Math.min(columns.length, 4)])}>
      {columns.map((column, index) => (
        <dl key={index} className="flex flex-col gap-4">
          {column.map((field) => (
            <FieldValue key={field.fieldname} field={field} doc={doc} schema={schema} />
          ))}
        </dl>
      ))}
    </div>
  )

  const heading = section.label && (
    <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.label}</h2>
  )

  // `collapsible` is authored on the Section Break and was previously read off the wire and
  // thrown away. A section the author marked collapsible is one they expect to be skipped.
  if (section.collapsible && section.label) {
    return (
      <Collapsible defaultOpen className="rounded-xl border border-border bg-card shadow-card">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-6 py-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {heading}
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-data-[state=closed]:-rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-6 pb-6">{body}</CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      {heading}
      <div className={section.label ? 'mt-4' : undefined}>{body}</div>
    </section>
  )
}

function FieldValue({ field, doc, schema }: { field: SchemaField; doc: DocRecord; schema: DoctypeSchema }) {
  const value = doc[field.fieldname]
  const Cell = CELL_RENDERERS[field.fieldtype] ?? FallbackCell
  const fullWidth = FULL_WIDTH_TYPES.has(field.fieldtype)
  const childSchema = CHILD_TABLE_TYPES.has(field.fieldtype)
    ? schema.child_schemas[field.options ?? '']
    : undefined

  return (
    <div className={fullWidth ? 'sm:col-span-full' : undefined}>
      <dt className="text-xs text-muted-foreground">{field.label ?? field.fieldname}</dt>
      <dd className="mt-1 text-sm text-foreground">
        {childSchema ? (
          <ChildTable schema={childSchema} value={value} label={field.label ?? childSchema.label} />
        ) : field.fieldtype === 'JSON' ? (
          // No editor, and no attempt at one: JSON here carries no schema (Institution's
          // accreditation is free-form), so it is shown as what it is and edited in Desk.
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
            {formatJson(value)}
          </pre>
        ) : (
          <Cell value={value} field={field} doctype={schema.doctype} />
        )}
      </dd>
    </div>
  )
}

/**
 * Which facts go in the summary strip.
 *
 * A module naming them wins outright. Otherwise: the first four short scalar fields the layout
 * places, skipping the title (already the heading), the status (already in the header), the
 * UUID `id` column (a machine identifier nobody reads) and anything `depends_on` hides on this
 * record. That is a guess, and it is a *stable* guess — field order is authored — which is what
 * makes it safe to leave in place until a module has an opinion.
 */
function resolveSummaryFields(
  schema: DoctypeSchema,
  byName: Map<string, SchemaField>,
  doc: DocRecord,
  override: ScreenOverride,
  statusFieldname: string,
): SchemaField[] {
  const named = override.record?.summaryFields
  if (named?.length) {
    return named
      .map((fieldname) => byName.get(fieldname))
      .filter((field): field is SchemaField => !!field)
      .filter((field) => evalCondition(field.depends_on, doc))
      .slice(0, 4)
  }

  const skip = new Set([schema.title_field, statusFieldname, 'id', 'name'])

  return (
    schema.layout
      .flatMap((tab) => tab.sections)
      .flatMap((section) => section.columns.flat())
      .map((fieldname) => byName.get(fieldname))
      .filter((field): field is SchemaField => !!field)
      .filter((field) => !skip.has(field.fieldname))
      .filter(isSummarisable)
      .filter((field) => evalCondition(field.depends_on, doc))
      // Only fields this record actually fills. A summary slot spent on "Campus —" is a quarter
      // of the strip saying nothing, and there are usually more candidates behind it. A field
      // NAMED by a module is never dropped this way: an empty value there is itself the answer.
      .filter((field) => hasValue(doc[field.fieldname]))
      .slice(0, 4)
  )
}

/** Blank in the sense the cells use: null, undefined or the empty string. `0` and `false` count. */
function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value !== 'string') return JSON.stringify(value, null, 2)
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    // Not valid JSON despite the fieldtype. Show it verbatim rather than an error — the record
    // is what it is, and hiding it helps nobody fix it.
    return value
  }
}

function titleOf(doc: DocRecord | undefined, schema: DoctypeSchema | undefined): string | null {
  if (!doc || !schema) return null
  const value = doc[schema.title_field]
  return typeof value === 'string' && value ? value : doc.name
}

/** The primary key, when the title is something else — so the record's real identity is visible. */
function subtitleOf(doc: DocRecord | undefined, schema: DoctypeSchema | undefined): string | undefined {
  if (!doc || !schema || schema.title_field === 'name') return undefined
  return doc.name
}
