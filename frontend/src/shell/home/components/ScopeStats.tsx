import { Building2Icon, BookOpenIcon, GraduationCapIcon, NetworkIcon, type LucideIcon } from 'lucide-react'

import type { ScopeStat } from '@/shared/lib/branding'
import type { InstitutionScope } from '@/shared/types/branding'
import { StatTile } from '@/shell/home/components/StatTile'

/** Hierarchy order — Campus → College → Department → Programme, matching `SCOPE_LABELS`. */
const SCOPE_ICONS: Record<keyof InstitutionScope, LucideIcon> = {
  campuses: Building2Icon,
  colleges: GraduationCapIcon,
  departments: NetworkIcon,
  programmes: BookOpenIcon,
}

/**
 * The institution's scale, as a row of KPI tiles: Campuses · Colleges · Departments · Programmes.
 *
 * Fed by `scopeStats`, which drops the zeros — a brand-new bench with one College and no Campuses
 * shows a single tile, not four with three noughts. The screen renders nothing when the list is
 * empty, so an unbranded bench simply has no strip; this component always has tiles to draw.
 */
export function ScopeStats({ stats }: { stats: ScopeStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <StatTile key={stat.key} label={stat.label} value={stat.value} icon={SCOPE_ICONS[stat.key]} />
      ))}
    </div>
  )
}
