import {
  DateRangeFilter,
  LinkFilter,
  NumberRangeFilter,
  TextFilter,
  type FilterControlProps,
} from '@/screens/doctype/components/column-filters/filter-controls'

/**
 * Fieldtype → column-filter control.
 *
 * A plain lookup record, not a factory — the same React Compiler constraint and the same split as
 * `cell-renderers.ts` and the form's `control-registry.ts`. A fieldtype absent here has no header
 * filter (Select/Check filter through the toolbar bar instead; everything else is not filterable).
 * Kept in step with `isColumnFilterable` in `lib/filters.ts`.
 */
export const FILTER_CONTROLS: Record<string, React.ComponentType<FilterControlProps>> = {
  Data: TextFilter,
  Link: LinkFilter,
  Int: NumberRangeFilter,
  Float: NumberRangeFilter,
  Currency: NumberRangeFilter,
  Date: DateRangeFilter,
  Datetime: DateRangeFilter,
}
