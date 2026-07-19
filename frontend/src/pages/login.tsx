import { LoginForm } from '@/components/auth/LoginForm'
import { LogoMark } from '@/components/brand/logo'
import { Card, CardContent } from '@/components/ui/card'
import { APP_NAME } from '@/lib/constants'

/**
 * Centered card, not a split-screen. A split-screen's second panel exists to hold a brand
 * image, which the ui skill rules out ("No giant hero sections", "productivity over
 * decoration") — and with no institution field there is nothing functional to put there.
 * Two fields centred is the densest honest rendering of this screen.
 */
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <LogoMark />
          <span className="font-heading text-base font-semibold text-foreground">{APP_NAME}</span>
        </div>

        {/* Card already ships ring-1 ring-foreground/10 — that IS DESIGN.md's "soft border,
            minimal shadow", so no shadow-* here. --card-spacing 24px = DESIGN.md card.padding. */}
        <Card className="[--card-spacing:--spacing(6)]">
          <CardContent>
            <div className="mb-6 flex flex-col gap-1.5">
              {/* A real <h1>: CardTitle renders a <div> with no asChild, so it cannot be a heading. */}
              <h1 className="font-heading text-xl leading-snug font-semibold text-foreground">Sign in</h1>
              <p className="text-sm text-muted-foreground">Use your institution account to continue.</p>
            </div>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </main>
  )
}
