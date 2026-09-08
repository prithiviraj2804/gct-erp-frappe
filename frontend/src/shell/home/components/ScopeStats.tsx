import type { ScopeStat } from '@/lib/branding'
import { StatTile } from '@/shell/home/components/StatTile'

/**
 * The institution's scale, as a row of KPI tiles: Campuses · Colleges · Departments · Programmes.
 *
 * Fed by `scopeStats`, which drops the zeros — a brand-new bench with one College and no Campuses
 * shows a single tile, not four with three noughts. The screen renders nothing when the list is
 * empty, so an unbranded bench simply has no strip; this component always has tiles to draw.
 *
 * The per-scope icons that used to ride along were removed with the tiles' icon plates: four
 * different glyphs implied four different KINDS of number, when every tile here is the same kind
 * of thing — a count of a level of the hierarchy, which its label already names.
 */
export function ScopeStats({ stats }: { stats: ScopeStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-(--section-stack) sm:grid-cols-4">
      {stats.map((stat) => (
        <StatTile key={stat.key} label={stat.label} value={stat.value} />
      ))}
    </div>
  )
}
