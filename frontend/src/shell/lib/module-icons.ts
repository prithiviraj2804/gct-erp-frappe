import { BoxIcon, DoorOpenIcon, LayersIcon, type LucideIcon } from 'lucide-react'

/**
 * Module Def carries no icon field, so the mapping lives here. Keyed by Module Def `name`
 * (the identifier), not the label, so renaming the display text can't silently break it.
 *
 * Consumed by the shell's rail. Kept as a shared lookup rather than inlined there, so any
 * second surface that names a module picks up the same icon by construction.
 *
 * Exported as a plain record rather than a `moduleIcon(name)` helper: a function that
 * *returns a component* and is called during render trips the React Compiler's
 * "Cannot create components during render" rule. A lookup is just data.
 */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  Gate: DoorOpenIcon,
  Master: LayersIcon,
}

export const FALLBACK_MODULE_ICON: LucideIcon = BoxIcon
