import type { Condition } from '@/screens/doctype/types'

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || value === 0 || value === '0'
}

/**
 * Evaluate a parsed `depends_on` / `mandatory_depends_on` against a record's values.
 *
 * The server has already turned `eval:` strings into data (`erp/api/doctype.py`), so there is
 * no expression evaluation here and nothing resembling `new Function`.
 *
 * `unsupported` — an expression the parser has not been taught — is the interesting case, and
 * the safe answer depends on which property it came from. Hence `fallback`, which callers must
 * choose deliberately:
 *
 *   - as `depends_on`, pass `true`. Showing a field that was not needed is cosmetic; hiding one
 *     that was needed hides data.
 *   - as `mandatory_depends_on`, pass `false`. Wrongly requiring a field is a block a user
 *     cannot argue with; wrongly not requiring it defers to the server, which is the authority
 *     regardless — `admission_gate_pass.py` enforces its own conditional requirements in
 *     `validate`, and `mandatory_depends_on` alone has never been enforced on save by anything.
 *
 * `test_doctype.py` asserts no expression in this app is unsupported, so this is a backstop for
 * the day someone authors a new one in the Desk form builder, not a routine path.
 */
export function evalCondition(
  condition: Condition | null,
  values: Record<string, unknown>,
  fallback = true,
): boolean {
  if (!condition) return true

  switch (condition.op) {
    case 'truthy':
      return !isEmpty(values[condition.field])
    case 'eq':
      return String(values[condition.field] ?? '') === condition.value
    case 'neq':
      return String(values[condition.field] ?? '') !== condition.value
    case 'in':
      return condition.values.includes(String(values[condition.field] ?? ''))
    case 'unsupported':
      if (import.meta.env.DEV) {
        console.warn(`Unsupported condition, defaulting to ${fallback}: ${condition.raw}`)
      }
      return fallback
  }
}
