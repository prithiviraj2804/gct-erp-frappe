import { useMutation, useQueryClient } from '@tanstack/react-query'

import { auth } from '@/lib/frappe'
import type { LoginValues } from '@/lib/schemas/auth'
import { sessionKeys } from '@/lib/session'
import type { LoginOutcome } from '@/types/auth'

async function login({ usr, pwd }: LoginValues): Promise<LoginOutcome> {
  const res = await auth.loginWithUsernamePassword({ username: usr, password: pwd })

  // A 2FA-enabled login answers 200 with tmp_id and no "Logged In". Treating that as
  // success would navigate, get bounced by the guard, and look like the button did
  // nothing. We don't handle OTP yet, but we do refuse to misreport it.
  if (res.tmp_id) return { status: 'otp-required', tmpId: res.tmp_id }

  return { status: 'logged-in', fullName: res.full_name }
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    // The QueryClient's default retry does not apply to mutations, but be explicit: a
    // silently re-sent login burns the consecutive-failure budget (10 on this site) and
    // can lock the account.
    retry: 0,
    onSuccess: async (outcome) => {
      if (outcome.status !== 'logged-in') return

      // Refetch before the caller navigates, so the route guard reads a fresh session
      // instead of flashing a spinner or bouncing back to /login.
      //
      // Not setQueryData: the login response carries full_name but NOT the user id, so a
      // complete Session can't be built from it. One extra request buys correctness.
      await queryClient.invalidateQueries({ queryKey: sessionKeys.current() })
    },
  })
}
