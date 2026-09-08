/**
 * The authoring half of the Bst-Table seam.
 *
 * `BstTable.tsx` is the component and re-exports the packages' *types*; this file re-exports
 * their *functions*, and it is a separate module for one mechanical reason — a file that
 * exports both a component and a plain function loses fast refresh, which
 * `react-refresh/only-export-components` enforces rather than suggests. The same split
 * `cells.tsx` / `cell-renderers.ts` already makes.
 *
 * Together the two files are the whole of what the app may use from `@bloomskill/*`. Nothing
 * else imports those packages by name, so `grep -rn "@bloomskill"` finds the seam and not
 * fifteen call sites.
 */

export {
  createCellTypeRegistry,
  defineCellType,
  createColumnHelper,
  flexRender,
} from '@bloomskill/table-engine'

export { createShadcnPreset } from '@bloomskill/table-shadcn'

export type {
  BstColumnMeta,
  BstOption,
  BstTableColumn,
  CellEditProps,
  CellRenderProps,
  CellType,
  CellTypeRegistry,
  CellValidateContext,
  FieldError,
} from '@bloomskill/table-engine'
