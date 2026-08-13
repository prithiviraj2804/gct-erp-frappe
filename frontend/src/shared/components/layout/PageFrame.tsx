import { cn } from '@/shared/lib/utils'

interface PageFrameProps {
  className?: string
  children: React.ReactNode
}

/**
 * The content-area gutter for a full-width screen.
 *
 * No max width, per DESIGN.md's `contentMaxWidth: 100%` — a seven-column table boxed into
 * `max-w-6xl` wastes half a desktop screen. Screens that need a bounded measure set their own:
 * the record page has `RecordFrame`, and the module overview has its own `max-w-6xl`, because
 * the right measure depends on what is being read, not on where it sits.
 */
export function PageFrame({ className, children }: PageFrameProps) {
  return <div className={cn('w-full px-6 py-6', className)}>{children}</div>
}
