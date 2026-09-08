import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { AppearanceProvider } from '@/components/appearance/AppearanceProvider'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/app/query-client'
import { ROUTER_BASENAME } from '@/lib/constants'
import '@/styles/index.css'
import App from '@/app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost, above the router: the theme is a document-level concern, and `Toaster` reads
        it too — before this provider existed, Sonner's `useTheme()` had nothing to read and
        resolved to `system`, so a toast could render dark on a light app. */}
    <AppearanceProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <App />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </AppearanceProvider>
  </StrictMode>,
)
