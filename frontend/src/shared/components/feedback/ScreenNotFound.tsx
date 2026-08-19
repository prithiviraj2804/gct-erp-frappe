import { Link } from 'react-router'

import { Button } from '@/shared/ui/button'
import { ROUTES } from '@/shared/lib/constants'

interface ScreenNotFoundProps {
  /** What was not found — "Module", "Screen". Rendered as "{thing} not found". */
  thing?: string
  /** Overrides the default two-causes explanation. */
  body?: string
  /** Where "Go back" points. Defaults to /home, the landing dashboard. */
  backTo?: string
  backLabel?: string
}

/**
 * A 404 rendered INSIDE the shell.
 *
 * `pages/not-found.tsx` is the shell-less one, and it is correct for a URL that has no module
 * context at all. It is wrong the moment the address names a module: a signed-in user who
 * mistypes a screen should keep the rail and the flyout they were navigating with, not be
 * dropped onto a bare page whose only way out is a link back to the root.
 *
 * The default copy names two causes on purpose. A user cannot tell "no such screen" apart from
 * "a screen you are not permitted", and the server deliberately makes them indistinguishable —
 * `get_module_menu` omits unpermitted links entirely, so an unpermitted deep link fails closed
 * and arrives here looking exactly like a typo. Saying so beats a bare 404 that implies a
 * broken link.
 */
export function ScreenNotFound({
  thing = 'Screen',
  body = 'There is nothing at this address, or it is not something you have access to.',
  backTo = ROUTES.HOME,
  backLabel = 'Go back',
}: ScreenNotFoundProps) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="font-heading text-xl font-semibold text-foreground">{thing} not found</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button asChild className="h-10">
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
