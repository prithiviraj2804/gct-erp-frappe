import { Navigate, Route, Routes } from 'react-router'

import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/shell/AppShell'
import { ROUTES } from '@/lib/constants'
import DashboardPage from '@/pages/dashboard'
import LoginPage from '@/pages/login'
import NotFoundPage from '@/pages/not-found'

export function AppRoutes() {
  return (
    <Routes>
      {/* Root goes to /login, not /dashboard, on purpose: /dashboard is guarded, so routing
          there would fire a session probe on every cold visit to "/". Keeping "/" inert
          means the app renders with no network at all, which is what lets e2e/smoke.spec.ts
          assert zero failed requests without a running bench.
          Trade-off: an already-signed-in user landing on "/" sees the login form rather
          than being bounced to /dashboard. */}
      <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.LOGIN} replace />} />
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />

      {/* Pathless layout route: everything inside gets the shell (topbar + rail + menu).
          This is what satisfies the ui skill's "every page follows the same hierarchy" —
          the user is never on a page without navigation context. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        </Route>
      </Route>

      {/* Outside the shell on purpose: a 404 has no module context to render. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
