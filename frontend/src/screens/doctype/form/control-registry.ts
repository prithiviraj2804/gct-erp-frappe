import { AttachImageControl } from '@/screens/doctype/form/AttachImageControl'
import type { ControlProps } from '@/screens/doctype/form/control-types'
import {
  CheckControl,
  ColorControl,
  DataControl,
  DateControl,
  DatetimeControl,
  JsonControl,
  NumberControl,
  SelectControl,
  TextControl,
} from '@/screens/doctype/form/controls'
import { LinkControl } from '@/screens/doctype/form/LinkControl'

/**
 * Fieldtype → control component.
 *
 * A plain record in a `.ts` module, not a `controlFor(fieldtype)` factory — the same React
 * Compiler constraint, and the same file split, as `components/cell-renderers.ts`.
 *
 * A fieldtype absent here is displayed read-only rather than edited; `EDITABLE_TYPES` in
 * `lib/form.ts` is the list that decides, and the two are kept in step by
 * `erp/api/test_doctype.py`, which fails when the app authors a fieldtype nothing supports.
 */
export const FIELD_CONTROLS: Record<string, React.ComponentType<ControlProps>> = {
  Data: DataControl,
  Link: LinkControl,
  Select: SelectControl,
  Check: CheckControl,
  Int: NumberControl,
  Float: NumberControl,
  Currency: NumberControl,
  Date: DateControl,
  Datetime: DatetimeControl,
  'Small Text': TextControl,
  Text: TextControl,
  Color: ColorControl,
  'Attach Image': AttachImageControl,
  JSON: JsonControl,
}
