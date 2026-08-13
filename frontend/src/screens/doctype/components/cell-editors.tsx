import { FIELD_CONTROLS } from '@/screens/doctype/form/control-registry'
import { readCellMeta } from '@/screens/doctype/lib/child-grid'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import type { CellEditProps } from '@/shared/components/table/registry'
import type { DocRecord } from '@/screens/doctype/types'

/**
 * The editors a Bst-Table cell opens, both of which are the app's existing form controls.
 *
 * Nothing here is a new input. `FIELD_CONTROLS` already holds one control per fieldtype, each
 * taking and returning the value in the shape Frappe stores it, and each carrying the reasoning
 * that shape needed — `DatetimeControl` translating `YYYY-MM-DD HH:mm:ss` without ever
 * constructing a `Date`, `LinkControl` searching through `search_link` with `link_filters`
 * resolved against its siblings, `NumberControl` keeping a half-typed `-` intact. A grid that
 * grew its own editors would have to re-learn all of it, and would get one of them wrong.
 *
 * `ControlProps` and the engine's `CellEditProps` line up almost exactly; these two components
 * are the adapter between them, and they are the only place that adapter exists.
 */

type EditorProps = CellEditProps<DocRecord>

/** The engine's error findings, as the one boolean a control takes. */
function isInvalid(props: EditorProps): boolean {
  return props.api.errors.some((error) => error.level === 'error')
}

/**
 * An editor inside the cell.
 *
 * The engine's host wraps this in a div that commits on Enter and on blur, so the control needs
 * to do neither — it writes to the draft and lets the host decide when that becomes a value.
 * `onBlur` is the form's "the user has visited this field" signal, which the grid has no use
 * for: a cell that is being edited has been visited by definition.
 */
export function CellEditor(props: EditorProps) {
  const carried = readCellMeta(props.meta)
  if (!carried) return null

  const Control = FIELD_CONTROLS[carried.frappeField.fieldtype]
  if (!Control) return null

  return (
    <Control
      field={carried.frappeField}
      value={props.draft}
      onChange={props.setDraft}
      onBlur={() => {}}
      disabled={props.api.isDisabled}
      invalid={isInvalid(props)}
      id={`cell-${props.rowId}-${props.columnId}`}
      // The child ROW, not the parent document: a child field's `link_filters` and
      // `depends_on` are expressed against its own siblings, which is the scope Frappe's grid
      // uses too. Draft-aware only as far as the last commit — see `child-grid.ts`.
      values={props.row}
      doctype={carried.doctype}
    />
  )
}

/**
 * An editor in a dialog, for the controls that open an overlay of their own.
 *
 * Two reasons it is a dialog rather than the control sitting in the cell. The engine suppresses
 * its blur commit for `editMode: 'popup'` and hands the editor the whole commit/cancel
 * lifecycle, so *something* has to own Save and Cancel. And a Link picker or a colour swatch in
 * a 140px column is a control the user cannot use — the popover it opens is wider than the cell
 * that triggered it.
 *
 * The app's `Dialog`, not the adapter's hand-rolled `.sc-modal`: this one traps focus, closes on
 * Escape, is announced as a dialog, and portals to the body — which also puts its buttons
 * outside the `<form>` the record editor wraps the grid in.
 */
export function CellPopupEditor(props: EditorProps) {
  const carried = readCellMeta(props.meta)
  if (!carried) return null

  const Control = FIELD_CONTROLS[carried.frappeField.fieldtype]
  if (!Control) return null

  const label = carried.frappeField.label ?? carried.frappeField.fieldname

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Escape, the close button, a click on the backdrop. All three mean "leave the value
        // as it was" — the draft is discarded rather than committed, because a dialog with a
        // Save button that also saves when dismissed makes Cancel a lie.
        if (!next) props.cancel()
      }}
    >
      {/* `DialogContent` carries the app's surface and nothing else — it is shaped for the
          command palette, which supplies its own padding. So the padding is here. */}
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription className="mt-1">
            {carried.frappeField.description ?? 'Done keeps the change; the row is saved with the document.'}
          </DialogDescription>
        </div>

        <div className="px-6 py-5">
          <Control
            field={carried.frappeField}
            value={props.draft}
            onChange={props.setDraft}
            onBlur={() => {}}
            disabled={props.api.isDisabled}
            invalid={isInvalid(props)}
            id={`cell-${props.rowId}-${props.columnId}`}
            values={props.row}
            doctype={carried.doctype}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <Button type="button" variant="outline" className="h-10" onClick={props.cancel}>
            Cancel
          </Button>
          <Button type="button" className="h-10" onClick={() => props.commit()}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
