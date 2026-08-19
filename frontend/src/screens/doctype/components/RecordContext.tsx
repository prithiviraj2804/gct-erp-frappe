import { CheckIcon } from 'lucide-react'
import { Link } from 'react-router'

import { useDoctypeLink } from '@/screens/doctype/lib/doctype-links'
import { hierarchyLevels } from '@/screens/doctype/lib/record-context'
import { statusTone, TONE_DOT_CLASS } from '@/screens/doctype/lib/status'
import { screenOverride } from '@/screens/doctype/registry'
import { cn } from '@/shared/lib/utils'
import type { DocRecord, DoctypeSchema } from '@/screens/doctype/types'

/**
 * Frappe's `YYYY-MM-DD HH:MM:SS`, trimmed to the minute.
 *
 * Deliberately not `toLocaleString`: the string arrives in the site's timezone already, and
 * parsing it as a Date would reinterpret it in the browser's — the same reason `DatetimeCell`
 * splits rather than parses. This renders the same shape that cell does, so a timestamp reads
 * identically in the rail and in the form.
 */
function datetime(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const [date = '', time = ''] = value.split(' ')
  return time ? `${date} ${time.slice(0, 5)}` : date
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold text-foreground">{title}</h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

/**
 * Where this record sits in the institution.
 *
 * Every one of these columns is denormalised onto the record precisely so a reader does not
 * have to walk the tree — the rail is that reading, in one place, instead of five Link fields
 * scattered through the form's sections.
 */
function HierarchyTrail({ schema, doc }: { schema: DoctypeSchema; doc: DocRecord }) {
  const levels = hierarchyLevels(schema, doc)

  if (levels.length === 0) return null

  return (
    <Card title="Where it sits">
      <ol className="flex flex-col gap-1.5">
        {levels.map((level, index) => (
          <li key={level.fieldname} className="flex items-baseline gap-2 text-sm">
            <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{level.label}</span>
            {/* Indented by depth, so the shape of the tree is visible without drawing one. */}
            <span className="min-w-0" style={{ paddingLeft: index * 6 }}>
              <HierarchyValue target={level.target} value={level.value} />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** A level's record, linked when the app has a screen for that doctype and plain when it does not. */
function HierarchyValue({ target, value }: { target: string | null; value: string }) {
  const route = useDoctypeLink(target)

  if (!route) return <span className="truncate text-foreground">{value}</span>

  return (
    <Link
      to={`${route}/${encodeURIComponent(value)}`}
      className="truncate rounded-sm text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {value}
    </Link>
  )
}

/**
 * The status scale, with this record's place on it.
 *
 * Rendered ONLY where a module has declared `statusFlow` — the words in lifecycle order. A
 * doctype's Select options are a set, not a sequence: `Active`/`Inactive` drawn as a stepper
 * would claim a progression that does not exist, and nothing in the schema distinguishes the
 * two cases. Declaring it is a one-line registry literal; guessing it is a lie.
 *
 * Note what this is not: a history. The app records no transition dates, so every step carries
 * its name and nothing else — reached, current, or still ahead.
 */
function StatusFlow({ flow, value, doctype }: { flow: string[]; value: string; doctype: string }) {
  const current = flow.indexOf(value)
  const tones = screenOverride(doctype).statusTones

  return (
    <Card title="Progress">
      <ol className="flex flex-col gap-2.5">
        {flow.map((step, index) => {
          const reached = current >= 0 && index < current
          const isCurrent = index === current
          return (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border-2',
                  reached && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && cn('border-primary ring-3 ring-primary/15', TONE_DOT_CLASS[statusTone(step, tones)]),
                  !reached && !isCurrent && 'border-border bg-card',
                )}
              >
                {reached && <CheckIcon className="size-2.5" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  'truncate',
                  isCurrent && 'font-medium text-foreground',
                  reached && 'text-foreground',
                  !reached && !isCurrent && 'text-muted-foreground',
                )}
              >
                {step}
              </span>
              {isCurrent && <span className="ml-auto text-xs text-muted-foreground">Now</span>}
            </li>
          )
        })}
        {/* A value outside the declared flow is a schema change the registry has not caught up
            with. Printed rather than hidden, because silently drawing an empty stepper reads as
            "no status at all". */}
        {current < 0 && (
          <li className="text-sm text-muted-foreground">
            Currently <span className="font-medium text-foreground">{value}</span>, which is not part of
            the recorded flow.
          </li>
        )}
      </ol>
    </Card>
  )
}

/** Who touched this record and when. Frappe writes these on every document. */
function RecordMeta({ doc }: { doc: DocRecord }) {
  const rows = [
    { label: 'Created', value: datetime(doc.creation) },
    { label: 'Modified', value: datetime(doc.modified) },
    { label: 'Owner', value: typeof doc.owner === 'string' ? doc.owner : null },
    // Not the `id` UUID: it is a real field on the record and the form already prints it.
    // The rail is for what the form cannot say.
  ].filter((row) => !!row.value)

  if (rows.length === 0) return null

  return (
    <Card title="Record">
      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 truncate text-right text-foreground tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

interface RecordContextProps {
  schema: DoctypeSchema
  doc: DocRecord
  /** The record's state field value, when it has one. */
  statusValue: string | undefined
}

/**
 * The record's context rail: what the form cannot say about itself.
 *
 * A form answers "what is on this record". It cannot answer "where does this sit in the
 * institution", "how far along is it", or "who last touched it" — those are properties OF the
 * record rather than fields in it, and folding them into a section would put them in an
 * arbitrary place among the authored ones.
 *
 * Renders nothing when it has nothing to say, so a doctype with no hierarchy and no declared
 * flow does not get an empty column beside its form.
 */
export function RecordContext({ schema, doc, statusValue }: RecordContextProps) {
  const flow = screenOverride(schema.doctype).record?.statusFlow

  return (
    <>
      {flow && flow.length > 1 && statusValue && (
        <StatusFlow flow={flow} value={statusValue} doctype={schema.doctype} />
      )}
      <HierarchyTrail schema={schema} doc={doc} />
      <RecordMeta doc={doc} />
    </>
  )
}
