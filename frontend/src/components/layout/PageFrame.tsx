import { cn } from '@/lib/utils'

interface PageFrameProps {
  className?: string
  children: React.ReactNode
}

/**
 * The content-area gutter for a full-width screen.
 *
 * The gutter is `--page-gutter-*`, not a literal 24px, so the app's density preference moves
 * it — see the Density block in `styles/index.css`. Every other frame in the app uses the same
 * pair, which is what stops a list and its own record disagreeing by 8px.
 *
 * No max width, per DESIGN.md's `contentMaxWidth: 100%` — a seven-column table boxed into
 * `max-w-6xl` wastes half a desktop screen. Screens that need a bounded measure set their own:
 * the record page has `RecordFrame`, and the module overview has its own `max-w-6xl`, because
 * the right measure depends on what is being read, not on where it sits.
 */
export function PageFrame({ className, children }: PageFrameProps) {
  return (
    <div className={cn('w-full px-(--page-gutter-x) py-(--page-gutter-y)', className)}>{children}</div>
  )
}
