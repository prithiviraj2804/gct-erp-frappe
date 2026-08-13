import { BstTableShadcn, type BstTableShadcnProps } from '@bloomskill/table-shadcn'

// Order is load order, and it is the contract this component owns: the engine's neutral
// defaults, then the adapter's shadcn skin over them, then `bst-table.css` re-pointing the
// adapter's variables at the app's theme tokens. Import them anywhere else and the last one
// stops being last.
import '@bloomskill/table-engine/styles.css'
import '@bloomskill/table-shadcn/styles.css'
import '@/shared/components/table/bst-table.css'

// The column type, because every consumer of this component needs it to declare one.
// Everything else the packages publish — the registry builders, the cell-type contracts, the
// shadcn preset that 0.2.0 added — is re-exported from `registry.ts`, which is a plain module
// and can hold functions without costing this file its fast refresh.
export type { BstTableColumn } from '@bloomskill/table-engine'

export interface BstTableProps<TData extends Record<string, unknown>> extends Omit<
  BstTableShadcnProps<TData>,
  'dark'
> {
  /** Applied to the wrapper element, not to the card — the card's own box is the adapter's. */
  className?: string
  /**
   * Screen-reader name for the table. The adapter renders no `<caption>`, so without this the
   * grid is an unnamed table — pass it unless a visible heading already names the region.
   */
  label?: string
}

/**
 * The app's handle on `@bloomskill/table-shadcn`.
 *
 * This is a client-side table: `data` is an array already in memory, and the engine (TanStack
 * v9) does the sorting, searching and pagination over it. There is no server-side mode to reach
 * for — `useBstTable` gives `useTable` a fixed option set with no `manualPagination`,
 * `manualSorting` or `rowCount` — so every screen using it must hold the rows it means to show.
 * `ChildTable` gets that for free; `DoctypeGrid` buys it with a row cap and says so.
 *
 * Two things are deliberately not passed through:
 *
 * `dark` — the adapter's theme switch. Dark mode here is the `.dark` class, so the switch is a
 * CSS concern; `bst-table.css` handles it and the prop would be a second, conflicting source of
 * truth. It is `Omit`ed rather than ignored, so the conflict is a type error, not a surprise.
 *
 * The stylesheets — imported here once. A consumer importing them itself would land after this
 * module in the graph and could displace the theme bridge.
 *
 * Everything else is the adapter's API unchanged, including the `enable*` behaviour toggles and
 * the `show*` chrome toggles, which is the point: this is a seam, not a second component.
 */
export function BstTable<TData extends Record<string, unknown>>({
  className,
  label,
  ...props
}: BstTableProps<TData>) {
  return (
    // `section` rather than `div`: it is what makes `aria-label` carry. An unnamed section is
    // not a landmark, so the element costs nothing when no label is given.
    <section className={className} aria-label={label} {...FORM_SAFE}>
      <BstTableShadcn {...props} />
    </section>
  )
}

/**
 * Keeping the grid from submitting the form it is sitting in.
 *
 * The adapter renders its toolbar and pagination chrome as bare `<button>` elements with no
 * `type`, and HTML's default for that is `submit`. Standalone that is invisible; inside
 * `DoctypeEditor`'s `<form>` — which is where the editable child grid lives — pressing
 * "+ Add row", "Save", or a page arrow saves the whole document instead, and Enter in the
 * grid's search box does the same. The engine's own cell buttons set `type="button"` and are
 * unaffected; this covers the adapter's, and any the packages add later.
 *
 * Capture phase, and `preventDefault` only. The default action of a click on a submit button
 * *is* the submission, so cancelling it is enough — propagation continues untouched, so the
 * button's own `onClick` still runs and the chrome still works. Same for Enter: the engine's
 * commit handler is on bubble and still fires.
 */
const FORM_SAFE = {
  onClickCapture(event: React.MouseEvent) {
    const button = (event.target as HTMLElement).closest?.('button')
    if (button && !button.hasAttribute('type')) event.preventDefault()
  },
  onKeyDownCapture(event: React.KeyboardEvent) {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
      event.preventDefault()
    }
  },
}
