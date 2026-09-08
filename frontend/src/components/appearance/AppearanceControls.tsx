import { MonitorIcon, MoonIcon, Rows2Icon, Rows4Icon, SunIcon } from 'lucide-react'

import { Segmented, type SegmentedOption } from '@/components/controls/Segmented'
import { DENSITY_LABELS, useDensity, type Density } from '@/global/density'
import { THEME_LABELS, useThemeChoice, type ThemeChoice } from '@/global/theme'

const THEME_OPTIONS: readonly SegmentedOption<ThemeChoice>[] = [
  { value: 'light', label: THEME_LABELS.light, icon: SunIcon },
  { value: 'dark', label: THEME_LABELS.dark, icon: MoonIcon },
  // Ordered light → dark → system, not system first: the two literal choices sit beside each
  // other so the control reads as a brightness scale, with "follow the OS" as the escape hatch
  // at the end. A monitor between a sun and a moon reads as a third brightness.
  { value: 'system', label: THEME_LABELS.system, icon: MonitorIcon },
]

const DENSITY_OPTIONS: readonly SegmentedOption<Density>[] = [
  { value: 'comfortable', label: DENSITY_LABELS.comfortable, icon: Rows2Icon },
  { value: 'compact', label: DENSITY_LABELS.compact, icon: Rows4Icon },
]

/**
 * Light / dark / system.
 *
 * `iconOnly` is for the status bar, where the control is chrome and the three glyphs are
 * self-evident; the labelled form is for the account menu, where it is a setting being read.
 * Both drive the same store, so the two surfaces can never show different answers.
 */
export function ThemeControl({
  iconOnly = false,
  fullWidth = false,
}: {
  iconOnly?: boolean
  fullWidth?: boolean
}) {
  const { choice, setChoice } = useThemeChoice()
  return (
    <Segmented
      label="Theme"
      value={choice}
      options={THEME_OPTIONS}
      onChange={setChoice}
      size={iconOnly ? 'sm' : 'default'}
      iconOnly={iconOnly}
      fullWidth={fullWidth}
    />
  )
}

/** Comfortable / compact — the app-wide row rhythm. See `density.ts`. */
export function DensityControl({
  iconOnly = false,
  fullWidth = false,
}: {
  iconOnly?: boolean
  fullWidth?: boolean
}) {
  const [density, setDensity] = useDensity()
  return (
    <Segmented
      label="Density"
      value={density}
      options={DENSITY_OPTIONS}
      onChange={setDensity}
      size={iconOnly ? 'sm' : 'default'}
      iconOnly={iconOnly}
      fullWidth={fullWidth}
    />
  )
}
