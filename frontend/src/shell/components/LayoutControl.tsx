import { Segmented, type SegmentedOption } from '@/components/controls/Segmented'
import { LAYOUT_HINTS, LAYOUT_LABELS, useLayout, type Layout } from '@/global/layout'

const OPTIONS: readonly SegmentedOption<Layout>[] = [
  { value: 'rail', label: LAYOUT_LABELS.rail },
  { value: 'topnav', label: LAYOUT_LABELS.topnav },
  { value: 'stacked', label: LAYOUT_LABELS.stacked },
]

/**
 * Which shell arrangement to render.
 *
 * A segmented control like theme and density, plus one line of explanation for the CURRENT
 * choice — because unlike those two, a layout is not self-evident from its name. "Stacked" tells
 * you nothing until you have seen it, and three permanent hint lines would triple the height of
 * the menu to explain two options nobody is looking at. Showing only the selected one keeps the
 * control the same size as its neighbours and still answers "what did I just pick?".
 *
 * The hint has a fixed two-line box so switching between options does not resize the menu under
 * the pointer — the same no-layout-shift rule the branded slots on the sign-in screen follow.
 */
export function LayoutControl() {
  const [layout, setLayout] = useLayout()

  return (
    <>
      <label className="mt-2.5 block text-xs font-medium text-muted-foreground" id="menu-layout-label">
        Layout
      </label>
      <div className="mt-1" aria-labelledby="menu-layout-label">
        <Segmented label="Layout" value={layout} options={OPTIONS} onChange={setLayout} fullWidth />
      </div>
      <p className="mt-1.5 min-h-8 text-2xs leading-4 text-muted-foreground">{LAYOUT_HINTS[layout]}</p>
    </>
  )
}
