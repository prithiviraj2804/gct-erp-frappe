import {
  CheckCell,
  ColorCell,
  CurrencyCell,
  DataCell,
  DateCell,
  DatetimeCell,
  ImageCell,
  LinkCell,
  NumberCell,
  SelectCell,
  TextCell,
  type CellProps,
} from '@/screens/doctype/components/cells'

/**
 * Fieldtype → cell component.
 *
 * A plain record in a `.ts` module, NOT a `cellFor(fieldtype)` factory. A function that
 * *returns a component* and is called during render trips the React Compiler's "Cannot create
 * components during render" rule — the same reasoning, and the same file split, as
 * `shell/lib/module-icons.ts`. A lookup is just data.
 *
 * `JSON` is absent on purpose: it is never a list column here, and `{"naac":"A++"}` inside a
 * 44px row is noise. The record page renders it properly instead.
 *
 * `Table` is absent too, and deliberately so — a child grid is not a cell. The record page
 * renders it from `child_schemas`; a table column pointing at one shows its row count via the
 * fallback, which is the only honest thing a 44px cell can say about twelve rows.
 */
export const CELL_RENDERERS: Record<string, React.ComponentType<CellProps>> = {
  Data: DataCell,
  Link: LinkCell,
  Select: SelectCell,
  Check: CheckCell,
  Int: NumberCell,
  Float: NumberCell,
  Currency: CurrencyCell,
  Date: DateCell,
  Datetime: DatetimeCell,
  'Small Text': TextCell,
  Text: TextCell,
  Color: ColorCell,
  'Attach Image': ImageCell,
}
