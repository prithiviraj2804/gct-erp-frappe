import { cn } from '@/lib/utils'

/**
 * One tile spec for everything in the rail.
 *
 * The rail holds five kinds of control now — the institution mark, the search launcher, the
 * module links, the appearance menu and the account — and they must be indistinguishable in
 * size, hit area and state, or a 56px column reads as five different widgets stacked up. This
 * is that spec, in one place, because it was already being copy-pasted between the module link
 * and its first neighbour.
 *
 * Sizing is DERIVED (`--rail-tile`, set in AppShell) rather than written here, so the tile and
 * the rail can never disagree. The `after:` pseudo restores a 48x44 pointer target around the
 * 40px visual tile: `-inset-x-1` is 4px into each 8px gutter and `-inset-y-0.5` fills the 4px
 * gap exactly, so adjacent targets touch without overlapping.
 *
 * Focus is an OUTLINE, not a box-shadow ring: outlines survive forced-colors (Windows High
 * Contrast) mode, where a ring silently disappears. And press differs from hover — the two used
 * to be byte-identical, so a click gave no feedback at all.
 */
export const RAIL_TILE = cn(
  'relative grid size-(--rail-tile) place-items-center rounded-lg text-rail-foreground-muted',
  "after:absolute after:-inset-x-1 after:-inset-y-0.5 after:content-['']",
  'transition-colors duration-150 ease-out motion-reduce:transition-none',
  'hover:bg-rail-accent hover:text-rail-foreground',
  'active:bg-rail-active',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rail-ring',
)
