import { TriangleAlertIcon, LogInIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'
import { normalizeFrappeError } from '@/lib/errors'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  /** Names what failed, e.g. "Records unavailable". */
  title?: string
}

/**
 * A failed query, with the server's own explanation and a way out.
 *
 * Calls `normalizeFrappeError` itself so no page has to import it just to render a message —
 * which is what keeps the SDK's error-shape quirks in one place rather than in fourteen.
 *
 * ## Why an expired session gets its own branch
 *
 * `RequireAuth` only guards the *route*: it probes the session on entry and redirects an
 * anonymous visitor to login. A session that ends while a screen is already open never passes
 * through it again — the next query simply 401s, and the screen rendered "Try again", which
 * retries forever against a session that is gone.
 *
 * Worse, five SPA endpoints used to throw `PermissionError("Not permitted")` for a Guest
 * caller, so a 403 and its `permission` kind reached this component and the screen told the
 * user they lacked permission for a doctype they administer. That was reported as exactly
 * that. The server now raises `AuthenticationError` — a 401, and this branch — so the two
 * cases are distinguishable at the only place that can tell them apart.
 *
 * A wrong diagnosis is worse than a terse one: it sends someone to check DocPerms that were
 * never the problem.
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  const location = useLocation()
  const { kind, message } = normalizeFrappeError(error)

  if (kind === 'auth') {
    return (
      <EmptyState
        tone="critical"
        icon={LogInIcon}
        title="Your session has ended"
        body={message}
        action={
          <Button className="h-10" asChild>
            {/* Carries where they were, so signing in returns them there rather than home. */}
            <Link to={ROUTES.LOGIN} state={{ from: location.pathname }}>
              Sign in again
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      tone="critical"
      icon={TriangleAlertIcon}
      title={title}
      body={message}
      action={
        onRetry && (
          <Button className="h-10" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  )
}
