import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ROUTES } from '@/shared/lib/constants'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { auth } from '@/shared/lib/frappe'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => auth.logout(),
    // onSettled, not onSuccess: if the call fails because the session is already dead, the
    // user still asked to leave. Dropping client state is right either way — a reload will
    // honestly re-probe and put them back if the server session somehow survived.
    onSettled: (_data, error) => {
      if (error) toast.error(normalizeFrappeError(error).message)

      // Navigate first so dashboard queries unmount instead of refetching into a dead
      // session on the way out.
      void navigate(ROUTES.LOGIN, { replace: true })

      // clear(), not invalidateQueries(): invalidate KEEPS the cached data and refetches,
      // so the next user to log in on this browser would briefly see the previous user's
      // data. In a multi-tenant ERP that is tenant leakage.
      queryClient.clear()
    },
  })
}
