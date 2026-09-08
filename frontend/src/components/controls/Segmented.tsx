import { useId, useRef } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Shown instead of the label when `iconOnly`. The label still names the option to AT. */
  icon?: React.ComponentType<{ className?: string }>
}

interface SegmentedProps<T extends string> {
  /** Names the group for screen readers. Required — a bare radiogroup announces nothing. */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** `sm` is the 22px status-bar size; `default` is the 28px menu/form size. */
  size?: 'sm' | 'default'
  /** Draw icons only. Each option must then supply an `icon`. */
  iconOnly?: boolean
  /**
   * Stretch to the parent's width, segments sharing it equally.
   *
   * For the stacked form used inside a menu, where the control sits under its label rather than
   * beside it. Beside-the-label is what overflowed: a three-segment control plus a label plus
   * gaps is wider than any sane menu, and `shrink-0` meant it pushed out of the panel instead of
   * compressing. Stacking removes the competition for width entirely.
   */
  fullWidth?: boolean
  className?: string
}

/**
 * A segmented control — one choice from two or three, all of them visible.
 *
 * Chosen over a Select for exactly that reason: a Select hides the alternatives behind a click,
 * which is right for twenty options and wrong for two. It is also chosen over a Switch, because
 * a switch can only express a boolean and both of this app's uses (theme, density) have a third
 * state that is not the negation of the other two — `system` is not "not light".
 *
 * ## Keyboard
 *
 * This is a real `radiogroup`, not a row of buttons with `aria-pressed`. That distinction is
 * what gets it the behaviour people expect from a segmented control: ONE tab stop for the whole
 * group (roving tabindex), then arrow keys move *and select* between segments. A row of buttons
 * would cost three tab stops to cross a control that occupies 90px, and would announce as three
 * unrelated toggles rather than one choice with three answers.
 *
 * Selection follows focus, per the APG's radio-group pattern — that is what makes arrowing feel
 * like a physical switch rather than a two-step "move, then confirm".
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'default',
  iconOnly = false,
  fullWidth = false,
  className,
}: SegmentedProps<T>) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  function move(delta: number) {
    const index = options.findIndex((option) => option.value === value)
    // Wraps, per the APG: arrowing past the last segment lands on the first. A control this
    // small should never present a dead end.
    const next = options[(index + delta + options.length) % options.length]
    if (!next) return
    onChange(next.value)
    // Focus follows the selection so the roving tabindex and the checked state stay on the same
    // element — otherwise a second arrow press moves from a stale origin.
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      // The track is the recessed plane and the selected segment is the raised one — the same
      // figure/ground the rest of the app uses, at 22px. `inline-flex` so the control is exactly
      // as wide as its segments and never stretches to fill a flex parent.
      // `bg-accent`, not `bg-muted`. The track has to READ as a recess, and --muted is 1.09:1
      // against --card — on the white status bar that put a card-coloured selected chip on an
      // almost-identical track, so nothing looked selected. --accent is 1.20:1, which is the
      // difference between a groove and a smudge. (It is nominally the hover fill, but the role
      // it is playing here is the same: one step down from the resting surface.)
      className={cn(
        'items-center rounded-md bg-accent p-0.5',
        fullWidth ? 'flex w-full' : 'inline-flex shrink-0',
        size === 'sm' ? 'h-[22px] gap-px' : 'h-7 gap-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            id={`${id}-${option.value}`}
            data-value={option.value}
            aria-checked={selected}
            // Roving tabindex: only the checked segment is in the tab order, so the group is one
            // stop. Without this the control costs three stops and Tab stops meaning "next
            // control".
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            title={iconOnly ? option.label : undefined}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium whitespace-nowrap',
              'transition-colors duration-150 ease-out motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              size === 'sm' ? 'text-2xs' : 'text-xs',
              fullWidth && 'flex-1',
              iconOnly
                ? size === 'sm'
                  ? 'size-[18px]'
                  : 'size-6'
                : size === 'sm'
                  ? 'h-[18px] px-2'
                  : 'h-6 px-2.5',
              selected
                ? // Raised: the app's card surface, its resting elevation, and a hairline ring.
                  // The ring is what survives dark mode — there `--card` and `--accent` are much
                  // closer and the shadow is nearly invisible against near-black, so without an
                  // edge the selected chip disappears in exactly the theme people notice most.
                  'bg-card text-foreground shadow-card ring-1 ring-foreground/10'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon ? <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} /> : null}
            {/* Icon-only still ships the label, to AT only — an icon is not an accessible name,
                and `title` alone is not reliably announced. */}
            <span className={iconOnly ? 'sr-only' : undefined}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
