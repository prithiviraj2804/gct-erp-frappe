import type { FormValues } from '@/pages/doctype/lib/form'
import type { SchemaField } from '@/pages/doctype/types'

/**
 * What every field control receives.
 *
 * One shape for all of them, so `control-registry.ts` can be a plain lookup rather than a
 * factory — the same React Compiler constraint that shaped `cell-renderers.ts`.
 */
export interface ControlProps {
  field: SchemaField
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  disabled: boolean
  invalid: boolean
  /** Ties the control to its `<label>` and its error message. */
  id: string
  /**
   * The whole form, live.
   *
   * Only the Link control uses it, and it has to: `link_filters` are expressed against sibling
   * fields (`eval:doc.institution`), so a Campus picker cannot know what to offer without
   * seeing what institution is currently selected.
   */
  values: FormValues
  /** The doctype being edited. Needed where a control's behaviour is a product decision. */
  doctype: string
}
