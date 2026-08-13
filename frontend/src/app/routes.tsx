import { Navigate, Route, Routes } from 'react-router'

import { RequireAuth } from '@/auth/components/RequireAuth'
import { ScreenNotFound } from '@/shared/components/feedback/ScreenNotFound'
import { AppShell } from '@/shell/components/AppShell'
import { ROUTES } from '@/shared/lib/constants'
import DoctypeCreatePage from '@/screens/doctype/pages/DoctypeCreateScreen'
import DoctypeListPage from '@/screens/doctype/pages/DoctypeListScreen'
import DoctypeRecordPage from '@/screens/doctype/pages/DoctypeRecordScreen'
import HomePage from '@/shell/pages/HomeScreen'
import LoginPage from '@/auth/pages/LoginScreen'
import ModulePage from '@/shell/pages/ModuleScreen'
import NotFoundPage from '@/app/NotFoundScreen'

export function AppRoutes() {
  return (
    <Routes>
      {/* Root goes to /login, not /home, on purpose: /home is guarded, so routing there
          would fire a session probe on every cold visit to "/". Keeping "/" inert means the
          app renders with no network at all, which is what lets e2e/smoke.spec.ts assert
          zero failed requests without a running bench.
          Trade-off: an already-signed-in user landing on "/" sees the login form rather
          than being bounced to /home. */}
      <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.LOGIN} replace />} />
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />

      {/* Pathless layout route: everything inside gets the shell (topbar + rail + menu).
          This is what satisfies the ui skill's "every page follows the same hierarchy" —
          the user is never on a page without navigation context. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {/* Redirects to the first allocated module — see pages/home.tsx. */}
          <Route path={ROUTES.HOME} element={<HomePage />} />
          {/* A module's overview: its screens, listed in the content area. Dynamic, so it
              also swallows any other single-segment path — ModulePage resolves the slug
              against the rail and renders its own 404 when it does not match one. Static
              routes still win: React Router ranks /login above /:moduleSlug regardless of
              declaration order. */}
          <Route path="/:moduleSlug" element={<ModulePage />} />
          {/* All three resolve their slugs against the rail and the cached menu, so an unknown
              or unpermitted doctype renders the in-shell 404 without reaching the server. */}
          <Route path="/:moduleSlug/:doctypeSlug" element={<DoctypeListPage />} />
          {/* Ranked above the `:name` route below — React Router prefers a static segment over
              a dynamic one regardless of declaration order. The cost is that a record whose
              primary key is literally "new" would be unreachable; no naming rule in this app
              can produce that. */}
          <Route path="/:moduleSlug/:doctypeSlug/new" element={<DoctypeCreatePage />} />
          <Route path="/:moduleSlug/:doctypeSlug/:name" element={<DoctypeRecordPage />} />
          {/* Anything deeper inside a module that has no page yet. Keeps the rail and the
              flyout: the address names a module, so the user still has navigation context and
              should not be dropped onto the shell-less 404 below. Ranked under the concrete
              routes above, which React Router matches by specificity, not declaration order. */}
          <Route path="/:moduleSlug/*" element={<ScreenNotFound />} />
        </Route>
      </Route>

      {/* Outside the shell on purpose: a 404 here has no module context to render. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
