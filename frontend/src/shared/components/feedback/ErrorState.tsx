import { TriangleAlertIcon } from 'lucide-react'

import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { Button } from '@/shared/ui/button'
import { normalizeFrappeError } from '@/shared/lib/errors'

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
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title={title}
      body={normalizeFrappeError(error).message}
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
