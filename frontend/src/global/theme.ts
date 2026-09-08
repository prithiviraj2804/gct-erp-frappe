import { useTheme } from 'next-themes'

/**
 * Three states, not a boolean.
 *
 * `system` is the default and is a real choice, not the absence of one: it means "follow the OS",
 * which is what most people want and what a two-state toggle cannot express. A user who picks
 * light explicitly stays light at 9pm; a user on `system` does not. Collapsing this to a switch
 * loses that distinction and is the most common way this control is built wrong.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system']

export const THEME_LABELS: Record<ThemeChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

/** Mirrored, deliberately, by the inline boot script in `index.html`. Rename both together. */
export const THEME_STORAGE_KEY = 'erp-theme'

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * The typed face of `next-themes`.
 *
 * next-themes is already a dependency and already the thing `shared/ui/sonner.tsx` reads to skin
 * its toasts — which, until this shipped, resolved to `system` for want of a provider, so a toast
 * could render dark on a light app. Wrapping rather than replacing it keeps one source of truth
 * for the theme instead of two that can disagree.
 *
 * `choice` is what the user picked (may be `system`); `resolved` is what is actually on screen.
 * A control that is asked to show a sun or a moon needs the second, and a control that is asked
 * which button is pressed needs the first — conflating them lights up the wrong segment for
 * everyone on `system`.
 */
export function useThemeChoice(): {
  choice: ThemeChoice
  resolved: 'light' | 'dark'
  setChoice: (next: ThemeChoice) => void
} {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return {
    choice: isThemeChoice(theme) ? theme : 'system',
    resolved: resolvedTheme === 'dark' ? 'dark' : 'light',
    setChoice: setTheme,
  }
}
