/**
 * Whether this is an Apple platform, for choosing between the ⌘ and Ctrl glyphs on a shortcut
 * hint. `navigator.platform` is deprecated and `userAgentData` is Chromium-only, so this reads
 * whichever exists and falls back to the non-Apple label. Getting it wrong costs a wrong glyph on
 * a hint, nothing more — which is why it is not worth a heavier detection than this.
 */
export function isApplePlatform(): boolean {
  const data = (navigator as { userAgentData?: { platform?: string } }).userAgentData
  const platform = data?.platform ?? navigator.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * The command-palette shortcut, labelled for this platform: "⌘K" on Apple, "Ctrl K" elsewhere.
 * One source for the hint, so the topbar launcher and any other surface that names the shortcut
 * can never tell two different stories about which key to press.
 */
export function commandPaletteHint(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl K'
}
