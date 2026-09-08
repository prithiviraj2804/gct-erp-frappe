import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect } from 'react'

import { useThemeChoice, THEME_STORAGE_KEY } from '@/global/theme'

/**
 * The colour the browser paints its OWN chrome with. Tracks `--card` — the topbar is what sits
 * at the top of the viewport, so that is what the browser bar should continue.
 *
 * It tracked `--sidebar-deep` while the chrome was ink in both themes. That is wrong now: the
 * light chrome is #E1E5EB, and a deep navy browser bar over a light app is the mismatch this
 * exists to prevent. Duplicated in `index.html`'s boot script — change both.
 */
const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#FFFFFF',
  dark: '#161C27',
}

/**
 * Keeps `<meta name="theme-color">` in step with the resolved theme.
 *
 * Cosmetic but cheap, and it is the difference between the browser's own chrome (mobile Safari's
 * bar, an installed PWA's title bar) matching the app and sitting a stark white slab above a dark
 * one. The boot script sets the first value; this handles every change after it.
 */
function ThemeColorSync() {
  const { resolved } = useThemeChoice()
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
  }, [resolved])
  return null
}

/**
 * Light / dark / system for the whole app.
 *
 * The `.dark` token block in `styles/index.css` shipped complete and measured but was
 * **unreachable** — nothing added the class, so half the palette was dead code that could rot
 * without anyone noticing. This is the provider its own comment said did not exist yet.
 *
 * Four options and each is load-bearing:
 * - `attribute="class"` matches `@custom-variant dark (&:is(.dark *))` in index.css. Switching
 *   this to the `data-theme` attribute silently disables every dark: utility in the app.
 * - `storageKey` is the app's own key, shared with the boot script in `index.html` that applies
 *   the class before first paint. next-themes' default (`theme`) would leave the boot script
 *   reading a key nothing writes, and every reload would flash.
 * - `enableSystem` is what makes `system` a third state rather than a synonym for light.
 * - `disableTransitionOnChange` suppresses transitions for one frame across the switch. Without
 *   it, every element carrying `transition-colors` crossfades on its own schedule and the theme
 *   change reads as a slow smear rather than a switch.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
