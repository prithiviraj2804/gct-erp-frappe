import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { useLogin } from '@/hooks/use-login'
import { ROUTES } from '@/lib/constants'
import { normalizeFrappeError } from '@/lib/errors'
import { loginSchema, type LoginValues } from '@/lib/schemas/auth'

const OTP_UNSUPPORTED =
  "Two-factor authentication isn't supported yet. Disable it in System Settings or contact your administrator."

/** Only accept a same-origin relative path — anything else is an open redirect. */
function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : ROUTES.DASHBOARD
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usr: '', pwd: '' },
  })

  const rootError = form.formState.errors.root?.message

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
            {...form.register('pwd')}
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
