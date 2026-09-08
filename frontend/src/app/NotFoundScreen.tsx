import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="font-heading text-xl font-semibold text-foreground">Page not found</h1>
        <Button asChild className="h-10">
          <Link to={ROUTES.ROOT}>Go back</Link>
        </Button>
      </div>
    </main>
  )
}
