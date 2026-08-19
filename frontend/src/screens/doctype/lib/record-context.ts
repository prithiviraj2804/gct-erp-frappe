import { screenOverride } from '@/screens/doctype/registry'
import type { DocRecord, DoctypeSchema } from '@/screens/doctype/types'

/**
 * The hierarchy, outermost first.
 *
 * Fixed rather than derived: this IS the app's hierarchy contract (see docs/DATA-MODEL.md), the
 * same order `validate_same_parent` reconciles on the server. A doctype carries the levels that
 * apply to it and no others, so a trail is built from whichever of these its schema defines.
 */
export const HIERARCHY = ['institution', 'campus', 'college', 'department', 'programme'] as const

/** The hierarchy levels this record actually carries a value for, outermost first. */
export function hierarchyLevels(schema: DoctypeSchema, doc: DocRecord) {
  return HIERARCHY.map((fieldname) => {
    const field = schema.fields.find((f) => f.fieldname === fieldname && f.fieldtype === 'Link')
    const value = doc[fieldname]
    if (!field || typeof value !== 'string' || !value) return null
    return { fieldname, label: field.label ?? fieldname, target: field.options, value }
  }).filter((level): level is NonNullable<typeof level> => level !== null)
}

/**
 * Whether the context rail would render anything at all.
 *
 * The record screen needs this BEFORE laying out, because the frame widens and splits into two
 * columns only when there is a rail to put in the second one — and it must make that decision
 * identically in read and edit mode, or pressing Edit would move every field sideways.
 */
export function hasRecordContext(schema: DoctypeSchema, doc: DocRecord): boolean {
  const flow = screenOverride(schema.doctype).record?.statusFlow
  return !!(flow?.length || hierarchyLevels(schema, doc).length || doc.creation || doc.modified)
}
