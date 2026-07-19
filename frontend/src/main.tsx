import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/global/query-client'
import { ROUTER_BASENAME } from '@/lib/constants'
import './styles/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <App />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
