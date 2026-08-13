import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, ArrowBigUpIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/shared/ui/input-group'
import { Spinner } from '@/shared/ui/spinner'
import { useLogin } from '@/auth/hooks/use-login'
import { ROUTES } from '@/shared/lib/constants'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { loginSchema, type LoginValues } from '@/shared/lib/schemas/auth'

const OTP_UNSUPPORTED =
  "Two-factor authentication isn't supported yet. Disable it in System Settings or contact your administrator."

/** Only accept a same-origin relative path — anything else is an open redirect. */
function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : ROUTES.HOME
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  // Caps Lock is the single most common cause of a "my password is right but it says
  // invalid" support call, and it is invisible while the field is masked. Detected from
  // keyboard events only — there is no way to read the modifier without one, so the hint
  // appears on the first keystroke rather than on focus.
  const [capsLock, setCapsLock] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usr: '', pwd: '' },
  })

  const rootError = form.formState.errors.root?.message

  const pwdField = form.register('pwd')

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'))
  }

  const onSubmit = form.handleSubmit((values) => {
    // Guard the in-flight case explicitly: `disabled` alone still lets a held Enter key
    // queue a second submit, and each failed attempt spends the account's lockout budget.
    if (login.isPending) return

    login.mutate(values, {
      onSuccess: (outcome) => {
        if (outcome.status === 'otp-required') {
          form.setError('root', { message: OTP_UNSUPPORTED })
          return
        }
        void navigate(safeRedirect(location.state?.from), { replace: true })
      },
      onError: (error) => {
        const { kind, message } = normalizeFrappeError(error)

        // Credential problems belong next to the fields the user just typed in. Everything
        // else is about the system, not their input, so it goes to a toast.
        if (kind === 'auth') {
          form.setError('root', { message })
          return
        }

        toast.error(message)
        if (kind === 'unknown') console.error('Unexpected login failure', error)
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {/* Always mounted so the live region exists before the message does — a role="alert"
          node inserted fresh is announced unreliably in some screen readers. */}
      <div aria-live="polite">
        {rootError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        )}
      </div>

      <Field data-invalid={!!form.formState.errors.usr}>
        <FieldLabel htmlFor="usr">
          Email or username <span aria-hidden="true">*</span>
        </FieldLabel>
        <Input
          id="usr"
          className="h-10"
          autoComplete="username"
          autoFocus
          required
          readOnly={login.isPending}
          aria-invalid={!!form.formState.errors.usr}
          {...form.register('usr')}
        />
        <FieldError errors={[form.formState.errors.usr]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.pwd}>
        <FieldLabel htmlFor="pwd">
          Password <span aria-hidden="true">*</span>
        </FieldLabel>
        <InputGroup className="h-10">
          <InputGroupInput
            id="pwd"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            readOnly={login.isPending}
            aria-invalid={!!form.formState.errors.pwd}
            aria-describedby={capsLock ? 'pwd-capslock' : undefined}
            {...pwdField}
            // After the spread, never before: `register` returns its own onBlur (it drives
            // touched state and validation) and a spread placed second would silently
            // replace these. Hence the explicit call-through below.
            //
            // Both key events, because keydown misses the press that turns Caps Lock ON and
            // keyup misses the one that turns it OFF — either alone leaves the hint a
            // keystroke stale.
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={(event) => {
              setCapsLock(false)
              void pwdField.onBlur(event)
            }}
          />
          <InputGroupAddon align="inline-end">
            {/* type="button" is load-bearing: the default is "submit". */}
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {/* Live region is always mounted, same reason as the alert above: a polite region
            inserted at the moment it gains content is announced unreliably. */}
        <div aria-live="polite">
          {capsLock && (
            <p id="pwd-capslock" className="flex items-center gap-1.5 text-xs text-warning">
              <ArrowBigUpIcon className="size-3.5 shrink-0" aria-hidden="true" />
              Caps Lock is on.
            </p>
          )}
        </div>

        <FieldError errors={[form.formState.errors.pwd]} />
      </Field>

      {/* Not disabled on empty input: a disabled submit explains nothing and is skipped by
          some screen-reader navigation. Let it submit, then validate and surface why. */}
      <Button type="submit" className="h-10 w-full max-md:h-11" disabled={login.isPending}>
        {login.isPending && <Spinner />}
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
