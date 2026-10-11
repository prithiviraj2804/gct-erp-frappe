import { AlertCircleIcon, ChevronDownIcon } from 'lucide-react'

import { ChildTable } from '@/pages/doctype/components/ChildTable'
import { FIELD_CONTROLS } from '@/pages/doctype/form/control-registry'
import type { DoctypeFormState } from '@/pages/doctype/hooks/use-doctype-form'
import { evalCondition } from '@/pages/doctype/lib/expressions'
import { CHILD_TABLE_TYPES, FULL_WIDTH_TYPES } from '@/pages/doctype/lib/fields'
import { isChildTableEditable, isEditable, isRequired, namingFields } from '@/pages/doctype/lib/form'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DoctypeSchema, SchemaField, SchemaSection } from '@/pages/doctype/types'

/**
 * The editable form for any doctype, laid out exactly as its record view is.
 *
 * Same tabs, same sections, same authored column split — because a form whose grouping differs
 * from the page it replaces makes the user re-find every field the moment they press Edit.
 *
 * Fields the user may not write (`read_only`, `fetch_from`, the `id` UUID, and the naming fields
 * once a record exists) are not omitted and not disabled-with-a-box: they render as plain
 * values, the way the record view shows them. A greyed input around `college.institution`
 * invites someone to try, and the interesting question is what the value *is*, not that it
 * cannot be typed. `lib/form.ts` owns that decision.
 */
export function DoctypeForm({
  schema,
  form,
  isCreate,
  serverMessages,
  disabled,
}: {
  schema: DoctypeSchema
  form: DoctypeFormState
  isCreate: boolean
  /** Messages the server refused the last save with. */
  serverMessages: string[]
  /** True while a save is in flight — the whole form freezes rather than each control. */
  disabled: boolean
}) {
  const byName = new Map(schema.fields.map((f) => [f.fieldname, f]))
  const tabs = schema.layout
  const locked = namingFields(schema.autoname)

  const body = (sections: SchemaSection[]) =>
    sections.map((section, index) => (
      <FormSection
        key={section.label ?? `section-${index}`}
        section={section}
        schema={schema}
        byName={byName}
        form={form}
        isCreate={isCreate}
        locked={locked}
        disabled={disabled}
      />
    ))

  return (
    <div className="flex flex-col gap-(--section-stack)">
      {serverMessages.length > 0 && (
        // Above the fields, not beside one: these are the server's objections and most of them
        // — a hierarchy mismatch, a duplicate key — belong to the document rather than to a
        // single input. Every message is listed; showing the first of four sends the user round
        // the save loop four times. See shared/lib/errors.ts.
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon aria-hidden="true" />
          <AlertDescription>
            {serverMessages.length === 1 ? (
              serverMessages[0]
            ) : (
              <ul className="list-disc space-y-1 pl-4">
                {serverMessages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {tabs.length <= 1 ? (
        <div className="flex flex-col gap-(--section-stack)">{body(tabs[0]?.sections ?? [])}</div>
      ) : (
        <Tabs defaultValue="0" className="gap-(--section-stack)">
          <TabsList>
            {tabs.map((tab, index) => (
              <TabsTrigger key={index} value={String(index)}>
                {tab.label ?? 'Details'}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab, index) => (
            // `forceMount` plus a CSS hide, so a required field on tab 3 is still mounted, still
            // validated and still submitted when the user saves from tab 1. Unmounted panels
            // would make the form silently drop half the document.
            <TabsContent
              key={index}
              value={String(index)}
              forceMount
              className="flex-col gap-(--section-stack) data-[state=active]:flex data-[state=inactive]:hidden"
            >
              {body(tab.sections)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

/** Static class strings, so Tailwind's scanner emits every one it may need. */
const COLUMN_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

function FormSection({
  section,
  schema,
  byName,
  form,
  isCreate,
  locked,
  disabled,
}: {
  section: SchemaSection
  schema: DoctypeSchema
  byName: Map<string, SchemaField>
  form: DoctypeFormState
  isCreate: boolean
  locked: Set<string>
  disabled: boolean
}) {
  const columns = section.columns
    .map((column) =>
      column
        .map((fieldname) => byName.get(fieldname))
        .filter((field): field is SchemaField => !!field)
        .filter((field) => evalCondition(field.depends_on, form.values)),
    )
    .filter((column) => column.length > 0)

  if (columns.length === 0) return null

  const heading = section.label && (
    <h2 className="text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">{section.label}</h2>
  )

  const grid = (
    <div className={cn('grid gap-x-8 gap-y-(--field-stack)', COLUMN_GRID[Math.min(columns.length, 4)])}>
      {columns.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-(--field-stack)">
          {column.map((field) => (
            <FormField
              key={field.fieldname}
              field={field}
              schema={schema}
              form={form}
              isCreate={isCreate}
              locked={locked}
              disabled={disabled}
            />
          ))}
        </div>
      ))}
    </div>
  )

  if (section.collapsible && section.label) {
    return (
      <Collapsible defaultOpen className="border-b border-border pb-(--section-stack) last:border-b-0">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-md py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {heading}
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:ease-emphasized group-data-[state=closed]:-rotate-90 group-data-[state=closed]:ease-exit motion-reduce:transition-none"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2">{grid}</div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <section className="border-b border-border pb-(--section-stack) last:border-b-0">
      {heading}
      <div className={section.label ? 'mt-(--field-stack)' : undefined}>{grid}</div>
    </section>
  )
}

function FormField({
  field,
  schema,
  form,
  isCreate,
  locked,
  disabled,
}: {
  field: SchemaField
  schema: DoctypeSchema
  form: DoctypeFormState
  isCreate: boolean
  locked: Set<string>
  disabled: boolean
}) {
  const editable = isEditable(field, schema, isCreate)
  const Control = FIELD_CONTROLS[field.fieldtype]
  const label = field.label ?? field.fieldname
  const fullWidth = FULL_WIDTH_TYPES.has(field.fieldtype)
  const id = `field-${field.fieldname}`
  const error = editable ? form.errorFor(field.fieldname) : undefined

  // The `id` UUID is never a form field, in either mode. It is not editable, the record view
  // already shows it, and an opaque machine identifier at the top of "Basic Information" is the
  // first thing a user's eye lands on and the last thing they need.
  if (field.fieldname === 'id') return null

  // A child table is a grid, not a control, so it takes neither branch below: `isEditable` is
  // false for it by design and `FIELD_CONTROLS` has nothing to offer, which together used to
  // land it in `ReadOnlyField` printing an em dash where the rows should be.
  const childSchema = CHILD_TABLE_TYPES.has(field.fieldtype)
    ? schema.child_schemas[field.options ?? '']
    : undefined

  if (childSchema) {
    const writable = isChildTableEditable(field)
    return (
      <div className="sm:col-span-full">
        <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
        <ChildTable
          schema={childSchema}
          value={form.values[field.fieldname]}
          label={label}
          disabled={disabled}
          onChange={writable ? (rows) => form.setValue(field.fieldname, rows) : undefined}
        />
        {field.description && <p className="mt-1.5 text-xs text-muted-foreground">{field.description}</p>}
      </div>
    )
  }

  if (!editable || !Control) {
    return <ReadOnlyField field={field} form={form} locked={locked} isCreate={isCreate} />
  }

  const required = isRequired(field, form.values)

  return (
    <div className={cn('min-w-0', fullWidth && 'sm:col-span-full')}>
      {/* Check renders its own inline label beside the box, so a second one above it would say
          the same thing twice. */}
      {field.fieldtype !== 'Check' && (
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
          {label}
          {required && (
            <>
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
              <span className="sr-only">(required)</span>
            </>
          )}
        </label>
      )}

      <Control
        field={field}
        value={form.values[field.fieldname]}
        onChange={(value) => form.setValue(field.fieldname, value)}
        onBlur={() => form.markTouched(field.fieldname)}
        disabled={disabled}
        invalid={!!error}
        id={id}
        values={form.values}
        doctype={schema.doctype}
      />

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : (
        field.description && <p className="mt-1.5 text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}

/**
 * A field the form shows but does not own.
 *
 * The `reason` line matters more than it looks. "College Code" going quietly read-only on edit,
 * with no explanation, reads as a bug — it was editable a moment ago, on the create form. Saying
 * that it is the record's identity is the difference between a locked field and a broken one.
 */
function ReadOnlyField({
  field,
  form,
  locked,
  isCreate,
}: {
  field: SchemaField
  form: DoctypeFormState
  locked: Set<string>
  isCreate: boolean
}) {
  const value = form.values[field.fieldname]
  const blank = value === null || value === undefined || value === ''
  const fullWidth = FULL_WIDTH_TYPES.has(field.fieldtype)

  // On a create form an empty read-only field is a label over an em dash for a value the
  // server has not computed yet — the `id` UUID being the obvious one. There is nothing to
  // read and nothing to do, so it is not shown at all.
  if (isCreate && blank) return null

  const reason =
    !isCreate && locked.has(field.fieldname)
      ? 'Part of this record’s identity — set once, when it was created.'
      : field.fetch_from
        ? 'Set automatically from a linked record.'
        : null

  return (
    <div className={cn('min-w-0', fullWidth && 'sm:col-span-full')}>
      <p className="text-xs text-muted-foreground">{field.label ?? field.fieldname}</p>
      <p className="mt-1 text-sm break-words text-foreground">
        {blank ? <span className="text-muted-foreground">—</span> : String(value)}
      </p>
      {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
    </div>
  )
}
