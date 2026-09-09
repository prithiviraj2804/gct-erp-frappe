import type { DoctypeSchema } from '@/pages/doctype/types'

/**
 * Whether the generic renderer may draw a *writable* form for this doctype.
 *
 * ## Why a doctype can be readable but not writable here
 *
 * A Field Policy decides, per institution, which of a doctype's fields are collected, which are
 * required, what they are called and what bounds they carry. None of that is in the schema this
 * renderer reads, because none of it is in the doctype's meta — `erp/field_policy.py` resolves it
 * from `Field Policy` rows at save time, server-side, and `erp.api.doctype` publishes only the
 * static DocField properties.
 *
 * So for a governed doctype the form this renderer would draw is the *ungoverned superset*: a
 * school counsellor sees the entrance-exam fields their institution does not collect, fills them
 * in, saves successfully, and `apply_field_policy` reverts the values on the server. It now says
 * so — but a message explaining that the app discarded what you typed is not a form working.
 *
 * Refusing to draw it is the honest answer while the renderer cannot ask
 * `erp.api.field_policy.get_policy`. Desk can: `admission_enquiry.js` calls it and redraws.
 *
 * ## What removing this looks like
 *
 * Not deleting the flag. It comes off when the renderer can resolve a policy, which needs four
 * things that do not exist yet: an `institution` parameter on `get_doctype_schema`, that
 * institution in the schema query key (it is `['doctype','schema',doctype]` today, so one
 * institution's form would be served to another), a current-institution concept in the session
 * (`get_session` returns user, full_name and roles), and a re-resolve when the user picks an
 * institution mid-form — because `institution` is a field *on the form being filled*.
 */
export function writesAllowed(schema: DoctypeSchema): boolean {
  return !schema.governed
}

/** Why writes are refused, for the empty state that replaces the form. */
export const GOVERNED_NOTICE =
  'This record is configured per institution — which fields it collects, and which are required, ' +
  'depends on the institution it belongs to. This screen cannot show that yet, so it would ask ' +
  'for the wrong fields. Use the Desk form, which applies the configuration.'
