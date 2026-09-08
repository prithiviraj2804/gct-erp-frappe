import { QueryClient } from '@tanstack/react-query'

import { normalizeFrappeError } from '@/lib/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A plain `retry: 1` retries 4xx, which is wrong for every query in this app: a 401,
      // 403 or 404 is an answer, not a blip, and repeating it only delays the error and
      // doubles the server's log noise. Only genuine connectivity failures are retried.
      retry: (failureCount, error) => normalizeFrappeError(error).kind === 'network' && failureCount < 2,
    },
  },
})
