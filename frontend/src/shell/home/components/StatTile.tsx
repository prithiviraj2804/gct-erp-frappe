interface StatTileProps {
  label: string
  value: number
}

/**
 * One KPI in the scope strip: an institution-scale count (Colleges, Departments, …).
 *
 * The number is the hero and the label names it — that is the whole tile. The 36px icon plate
 * that used to sit above them is GONE: it took 48 of the tile's 126px, said nothing the label
 * beneath it did not, and — drawn on a tint that measured 1.013:1 against white — rendered as a
 * plain grey square. That is brand colour spent where it physically could not register, which is
 * the exact allocation this palette inverts. 126px → 78px, and the strip stops competing with
 * the content below it.
 */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-(--card-pad) shadow-card">
      <p className="font-heading text-2xl leading-none font-semibold tracking-[-0.018em] text-foreground tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">{label}</p>
    </div>
  )
}
