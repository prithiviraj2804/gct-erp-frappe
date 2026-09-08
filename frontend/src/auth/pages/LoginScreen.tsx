import { InstitutionPanel } from '@/auth/components/InstitutionPanel'
import { LoginForm } from '@/auth/components/LoginForm'
import { InstitutionMark } from '@/components/brand/InstitutionMark'
import { useBrandedDocument, useLoginBranding } from '@/hooks/use-branding'
import { institutionMetaLine } from '@/lib/branding'
import { APP_NAME } from '@/lib/constants'
import type { InstitutionBrand } from '@/types/branding'

/**
 * Sign-in, branded from the Institution record.
 *
 * Two columns on `lg` and up: the institution's identity on the left, the form on the right.
 * This replaces an earlier centred card whose comment argued a split screen had nothing
 * functional to put in the second panel. That is no longer true — `erp.api.branding` publishes
 * the institution's mark, type, location, accreditation and scale, which is exactly the
 * "whose ERP am I signing into?" answer a multi-tenant system owes the user up front.
 *
 * Three rules hold the screen together:
 *
 * 1. **Branding never gates the form.** The request is fire-and-forget: the fields are
 *    focusable and submittable on first paint, and a failed or slow branding call costs
 *    nothing but an unbranded panel. Signing in is the job; identity is context.
 * 2. **No layout shift.** Every branded slot is fixed-height or skeletoned at its final size,
 *    so the resolved payload swaps in without moving the form under the user's cursor.
 * 3. **Every branded state is designed.** Logo and monogram, accredited and not, one college
 *    and forty — each has to render as a finished screen, because on a fresh bench the sparse
 *    state is the only one anyone will ever see.
 */
export default function LoginPage() {
  const { data, isPending } = useLoginBranding()
  const brand = data?.institution ?? null

  useBrandedDocument('Sign in', brand)

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(30rem,34rem)]">
      <InstitutionPanel brand={brand} scope={data?.scope ?? null} isPending={isPending} />

      {/* min-h-dvh + overflow-y-auto: on a short window the form column scrolls inside itself
          rather than dragging the identity panel out of view. */}
      <main className="flex max-h-dvh flex-col overflow-y-auto bg-card px-6 py-10 sm:px-12 lg:px-14 lg:py-12">
        {/* The panel is hidden below lg, so identity is restated here — compactly, and without
            the scope strip, which is context rather than identity. */}
        <MobileIdentity brand={brand} isPending={isPending} />

        <div className="flex flex-1 flex-col justify-center py-8 lg:py-0">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {brand
                ? `Use your ${brand.short_name || brand.name} account to continue.`
                : 'Use your institution account to continue.'}
            </p>

            <div className="mt-8">
              <LoginForm />
            </div>

            <SupportNote brand={brand} />
          </div>
        </div>

        {/* The copyright names the institution, not the software. There is deliberately no
            "powered by" line: this screen identifies one tenant, and a vendor credit under
            their own copyright is the one piece of marketing an ERP sign-in does not owe
            anybody. */}
        <footer className="mx-auto w-full max-w-sm pt-8 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {brand?.name ?? APP_NAME}
          </p>
        </footer>
      </main>
    </div>
  )
}

function MobileIdentity({ brand, isPending }: { brand: InstitutionBrand | null; isPending: boolean }) {
  const meta = institutionMetaLine(brand)

  return (
    <div className="mx-auto w-full max-w-sm lg:hidden">
      {isPending ? (
        // Mirrors the resolved block's height (36px mark beside two text lines) so the form
        // below does not jump when branding lands.
        <div aria-hidden="true" className="flex animate-pulse items-center gap-3">
          <div className="size-9 shrink-0 rounded-md bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-48 max-w-full rounded bg-muted" />
            <div className="mt-1.5 h-3 w-24 rounded bg-muted" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <InstitutionMark brand={brand} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              {brand?.name ?? APP_NAME}
            </p>
            {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Where to go when sign-in fails for a reason the form cannot fix — a forgotten password, a
 * disabled account, a user who was never created. This app has no self-service recovery (no
 * registration, no reset flow), so the only honest answer is a human, and the institution's
 * own published contact details are the closest thing to one on file.
 */
function SupportNote({ brand }: { brand: InstitutionBrand | null }) {
  const email = brand?.support_email
  const phone = brand?.support_phone

  return (
    <div className="mt-8 border-t border-border pt-5">
      <p className="text-sm font-medium text-foreground">Trouble signing in?</p>
      {email || phone ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Contact{' '}
          {email && (
            <a
              href={`mailto:${email}`}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {email}
            </a>
          )}
          {email && phone && ' or '}
          {phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {phone}
            </a>
          )}
          .
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Accounts are created by your administrator — contact them to have yours reset or enabled.
        </p>
      )}
    </div>
  )
}
