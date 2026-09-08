import { cn } from '@/lib/utils'

/**
 * A key cap.
 *
 * One spec, in one place. This chip was written out longhand at two call sites (the topbar
 * launcher and the home page's Quick Access hint) with a comment at one of them promising the
 * two were "shared verbatim" — which is a convention, and conventions drift. Adding the
 * shortcuts dialog would have made three copies of a five-class string, so it became a
 * component instead.
 *
 * `font-sans`, not `font-mono`: a monospace ⌘ or "Ctrl" is wider, sits on a different baseline
 * to the sentence around it, and buys nothing — this is a label for a key, not code.
 */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'rounded-xs border border-border px-1.5 py-px font-sans text-2xs font-medium whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
