/**
 * Shapes returned by `erp.api.doctype.get_doctype_schema`.
 *
 * These describe a doctype, never its data. A row is `DocRow` — an untyped bag, because the
 * whole point of the generic screens is that the columns are decided at runtime by the server.
 */

/** Frappe stores DocField booleans as 0/1 ints, and they arrive that way. */
export type FrappeBool = 0 | 1

/**
 * A `depends_on` / `mandatory_depends_on` expression, already parsed server-side.
 *
 * The SPA never sees the word `eval`. `unsupported` is not an error — it means the app authored
 * an expression the parser has not been taught, and the renderer must choose a safe default
 * (see `evalCondition`).
 */
export type Condition =
  | { op: 'truthy'; field: string }
  | { op: 'eq' | 'neq'; field: string; value: string }
  | { op: 'in'; field: string; values: string[] }
  | { op: 'unsupported'; raw: string }

/**
 * One row of a Link field's `link_filters`.
 *
 * `from_field` means "compare against this sibling field's current value"; `value` is a literal.
 * A **picker convenience only** — Frappe does not enforce link_filters on save, and neither do
 * we. See docs/DATA-MODEL.md.
 */
export type LinkFilter =
  | { fieldname: string; operator: string; from_field: string }
  | { fieldname: string; operator: string; value: unknown }

export interface SchemaField {
  fieldname: string
  fieldtype: string
  label: string | null
  /** Link target, or the newline-separated option list for a Select. */
  options: string | null
  default: string | null
  description: string | null
  reqd: FrappeBool
  read_only: FrappeBool
  hidden: FrappeBool
  unique: FrappeBool
  precision: string | number | null
  length: number
  /** `college.institution` — the server derives this field, so it is never editable. */
  fetch_from: string | null
  non_negative: FrappeBool
  in_list_view: FrappeBool
  in_standard_filter: FrappeBool
  depends_on: Condition | null
  mandatory_depends_on: Condition | null
  link_filters: LinkFilter[] | null
}

/**
 * One Section Break and the Column Breaks inside it, as fieldnames in render order.
 *
 * `columns` is the authored split, not a flattened list — a two-column section and a
 * three-column section are different instructions and the renderer cannot tell them apart
 * once the grouping is gone.
 */
export interface SchemaSection {
  label: string | null
  collapsible: boolean
  columns: string[][]
}

/**
 * One Tab Break and the sections under it.
 *
 * A doctype that authors no tabs gets exactly one, with a null label — so the renderer's test
 * for "should there be a tab strip?" is `layout.length > 1`, never a special case.
 */
export interface SchemaTab {
  label: string | null
  sections: SchemaSection[]
}

/** Enough of a child doctype to draw its grid. Travels with the parent's schema. */
export interface ChildSchema {
  doctype: string
  label: string
  fields: SchemaField[]
  /** Grid columns in order, from the child's own `in_list_view`. */
  columns: string[]
}

export interface DoctypeSchema {
  doctype: string
  module: string
  label: string
  /** The field that identifies a row to a human. Falls back to `name`. */
  title_field: string
  /**
   * `field:college_code` / `format:{institution}-{campus_code}` / `naming_series:`.
   *
   * Naming is computed on insert and never recomputed, so a field named here must be locked
   * once the record exists — editing it moves the column while `name` stays put, with no
   * error. See docs/DATA-MODEL.md.
   */
  autoname: string | null
  is_submittable: boolean
  fields: SchemaField[]
  /** Tabs → sections → columns → fieldnames. Always at least one tab. */
  layout: SchemaTab[]
  /** Keyed by child doctype. Empty `{}` when the doctype has no Table field — never absent. */
  child_schemas: Record<string, ChildSchema>
  /** Table columns in order. `list_columns[0]` is the identity and links to the record. */
  list_columns: string[]
  filter_fields: string[]
  search_fields: string[]
  sort_field: string
  sort_order: 'asc' | 'desc'
  /** Advisory — decides which buttons render. The framework re-checks every write. */
  permissions: {
    can_create: boolean
    can_write: boolean
    can_delete: boolean
  }
}

/** A list row. Keys are whatever `list_columns` asked for, plus `name`. */
export type DocRow = Record<string, unknown> & { name: string }

/** A full document. Same reasoning — the fields are decided by the schema, not by TypeScript. */
export type DocRecord = Record<string, unknown> & { name: string }
