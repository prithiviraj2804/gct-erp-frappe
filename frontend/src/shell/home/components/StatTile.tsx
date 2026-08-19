import type { LucideIcon } from 'lucide-react'

interface StatTileProps {
  label: string
  value: number
  icon: LucideIcon
}

/**
 * One KPI in the scope strip: an institution-scale count (Colleges, Departments, …).
 *
 * Stacked — icon, then the number as the hero, then the label — so the label owns the tile's full
 * width and never truncates when four tiles are squeezed two-up on a phone. One calm accent
 * (`primary` on its subtle tint) for every tile, never a per-tile colour: the ui skill's "no
 * colourful dashboards", where the number is the signal and colour that varied tile to tile would
 * imply a meaning it does not carry.
 */
export function StatTile({ label, value, icon: Icon }: StatTileProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card ring-1 ring-foreground/10">
      <span
        className="grid size-9 place-items-center rounded-lg bg-primary-subtle text-primary"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-heading text-2xl leading-none font-semibold text-foreground tabular-nums">
          {value.toLocaleString()}
        </p>
        <p className="mt-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      </div>
    </div>
  )
}
