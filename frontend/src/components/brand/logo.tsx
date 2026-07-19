import { cn } from '@/lib/utils'

/**
 * Placeholder brand mark — no real artwork exists yet (src/assets/ only held Vite demo
 * files). Uses currentColor/--primary so it themes automatically; swap the <svg> when real
 * artwork lands, and the layout around it won't need to change.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 text-primary', className)}
      role="img"
      aria-label="ERP"
      fill="none"
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M10 20.5c1.6 1.3 3.4 2 5.4 2 2.9 0 4.8-1.4 4.8-3.5 0-2-1.4-3-4.3-3.7l-1.3-.3c-1.4-.3-2-.8-2-1.6 0-1 .9-1.6 2.4-1.6 1.4 0 2.8.5 4 1.4"
        stroke="var(--color-primary-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
