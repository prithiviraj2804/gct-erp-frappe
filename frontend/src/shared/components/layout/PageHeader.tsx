import { Fragment } from 'react'
import { Link } from 'react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'

export interface Crumb {
  label: string
  /** Omit on the last crumb — the page you are already on is not a link. */
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  /**
   * Row count, rendered beside the title. Deliberately optional and deliberately allowed to be
   * undefined *while loading and while searching* — see `fetchDocCount`, which cannot count a
   * searched list. A missing number is honest; a wrong one is not.
   */
  count?: number
  crumbs?: Crumb[]
  actions?: React.ReactNode
}

/**
 * Breadcrumb → title → actions, the top of every screen below the shell.
 *
 * This is the `ui` skill's page hierarchy (Top Nav → Module Sidebar → Breadcrumb → Page Header
 * → Actions → Filters → Content) and the first use of the breadcrumb primitive, which has been
 * vendored and unused until now.
 */
export function PageHeader({ title, subtitle, count, crumbs, actions }: PageHeaderProps) {
  return (
    <header>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              // Separator is a SIBLING of the item, not a child: both render <li>, and
              // nesting them is invalid HTML that React reports at runtime.
              <Fragment key={`${crumb.label}-${i}`}>
                <BreadcrumbItem>
                  {crumb.to ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {i < crumbs.length - 1 && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {count !== undefined && (
              <span className="text-sm text-muted-foreground tabular-nums">{count}</span>
            )}
          </div>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
