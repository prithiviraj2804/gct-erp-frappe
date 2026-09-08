import { createElement } from 'react'

import { CellEditor, CellPopupEditor } from '@/pages/doctype/components/cell-editors'
import { CELL_RENDERERS } from '@/pages/doctype/components/cell-renderers'
import { FallbackCell } from '@/pages/doctype/components/cells'
import {
  FRAPPE_CELL,
  FRAPPE_MULTILINE_CELL,
  FRAPPE_POPUP_CELL,
  readCellMeta,
} from '@/pages/doctype/lib/child-grid'
import {
  createShadcnPreset,
  defineCellType,
  type CellEditProps,
  type CellRenderProps,
  type CellTypeRegistry,
} from '@/components/table/registry'
import type { DocRecord } from '@/pages/doctype/types'

/**
 * The app's cell-type registry for Bst-Table.
 *
 * `createElement` rather than JSX, and a `.ts` module rather than a `.tsx` one, for the reason
 * `cell-renderers.ts` and `control-registry.ts` are both plain records: this file *is* data — a
 * lookup from a type id to a pair of render functions. The components it points at live in
 * `cell-editors.tsx` and `cells.tsx`, which keeps `react-refresh/only-export-components` happy
 * and keeps the React Compiler from seeing a component built during render.
 *
 * Why the app registers its own at all is in `lib/child-grid.ts`: the engine's neutral cell
 * types cannot express a Frappe `Link` or a naive site-timezone `Datetime`, and this app has
 * already answered both. Everything the app does *not* override — the shadcn preset's chrome,
 * its long-text and file dialogs, the neutral `action` column that draws the row buttons — is
 * inherited by cloning `createShadcnPreset()` rather than reimplemented.
 */

/** Read side: the same component the record page and the list table use for this fieldtype. */
function renderRead(props: CellRenderProps<DocRecord>) {
  const carried = readCellMeta(props.meta)
  if (!carried) return null

  const Cell = CELL_RENDERERS[carried.frappeField.fieldtype] ?? FallbackCell
  return createElement(Cell, {
    value: props.value,
    field: carried.frappeField,
    doctype: carried.doctype,
  })
}

function renderEdit(props: CellEditProps<DocRecord>) {
  return createElement(CellEditor, props)
}

function renderPopupEdit(props: CellEditProps<DocRecord>) {
  return createElement(CellPopupEditor, props)
}

/** Copy / clipboard text. The read renderers return nodes, so the plain value is the honest one. */
function format(value: unknown) {
  return value == null ? '' : String(value)
}

const frappeCellType = defineCellType({
  id: FRAPPE_CELL,
  renderRead,
  renderEdit,
  format,
})

const frappeMultilineCellType = defineCellType({
  ...frappeCellType,
  id: FRAPPE_MULTILINE_CELL,
  // What the flag actually gates in the engine is Enter-to-commit, despite its name.
  capturesArrowKeys: true,
})

const frappePopupCellType = defineCellType({
  ...frappeCellType,
  id: FRAPPE_POPUP_CELL,
  editMode: 'popup',
  renderEdit: renderPopupEdit,
})

/**
 * A registry per grid, not one shared module-level instance.
 *
 * `createCellTypeRegistry` returns a mutable object with a `register` method, so a single
 * exported instance would be one grid's `register` call away from changing every other grid on
 * the screen. It is cheap — three closures over a Map — and `ChildTable` memoises it.
 */
export function createFrappeCellTypes(): CellTypeRegistry {
  const registry = createShadcnPreset()
  registry.register(frappeCellType)
  registry.register(frappeMultilineCellType)
  registry.register(frappePopupCellType)
  return registry
}
