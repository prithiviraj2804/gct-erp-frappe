/**
 * Status vocabularies and the tone each word carries.
 *
 * A doctype's `Select` options are just strings — the schema says `Inside|Exited` but not that
 * one of those is the resting state and the other is the finished one. That reading is a
 * product decision, so it lives beside the module it belongs to (`src/modules/<module>/`) and
 * is looked up through the screen registry, not hardcoded into a shared cell.
 *
 * Only `Active`/`Inactive` is here, because it is the one vocabulary genuinely shared by
 * eleven of the app's doctypes. Everything narrower — the gate desk's `Inside`, the intake's
 * `Draft` — is that module's word and belongs to that module.
 *
 * ## Why a dot rather than a filled pill
 *
 * A tinted badge (`bg-success/10 text-success`) measures ~4.37:1 for the success step, under
 * the 4.5:1 this app holds itself to — the same failure DESIGN.md already recorded for
 * `destructive` and solved with a darker `--destructive-subtle-foreground`. Rather than
 * introduce three more corrected foregrounds, the tone moves onto a 6px dot: a dot is
 * non-text, so it answers to WCAG 1.4.11's 3:1 bar, which every step below clears
 * comfortably. The label beside it stays `--foreground` at 16.7:1.
 *
 * That is also the better design. A dense table of forty rows with a filled pill in every
 * status cell is a column of colour; a dot reads as a state and lets the text carry the
 * meaning. Colour is never the only signal — the word is always printed.
 */

export type StatusTone = 'positive' | 'negative' | 'attention' | 'info' | 'neutral'

/** The vocabulary shared across the app. Module-specific words live in `src/modules/`. */
export const SHARED_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Active: 'positive',
  Inactive: 'neutral',
}

/**
 * Dot fill per tone. Non-text, so the 3:1 bar applies and every step clears it on `--card`:
 * success 5.02:1, destructive 4.83:1, warning 5.02:1, info 5.93:1, muted-foreground 7.12:1.
 */
export const TONE_DOT_CLASS: Readonly<Record<StatusTone, string>> = {
  positive: 'bg-success',
  negative: 'bg-destructive',
  attention: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
}

/**
 * The tone for one status word on one doctype.
 *
 * Unknown words resolve to `neutral` rather than to a guess. A vocabulary this file has not
 * been told about is a vocabulary nobody has decided the meaning of, and inventing one paints
 * "Rejected" green as readily as red.
 */
export function statusTone(value: string, overrides?: Readonly<Record<string, StatusTone>>): StatusTone {
  return overrides?.[value] ?? SHARED_STATUS_TONES[value] ?? 'neutral'
}
