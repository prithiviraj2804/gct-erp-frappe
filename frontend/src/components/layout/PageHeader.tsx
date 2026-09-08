import { Fragment } from 'react'
import { Link } from 'react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export interface Crumb {
  label: string
  /** Omit on the last crumb — the page you are already on is not a link. */
  to?: string
}

interface PageHeaderProps {
  title: string
  /** Prose under the title. Shares the meta line with `note`. */
  subtitle?: string
  /**
   * A fact about the page's current state — a truncation notice, a scope. Kept as a slot rather
   * than a string so a caller can mark part of it up.
   *
   * This is NOT the place for a row count. The list's total lives in the table footer, beside the
   * pagination it belongs to ("1–20 of 1,284"), where it is a control's readout rather than a
   * decoration under a heading. A count restated in the header is the same number twice, and the
   * copy under the title is the one nobody can act on.
   */
  note?: React.ReactNode
  /**
   * One state chip belonging to the TITLE'S SUBJECT — a record's status, not a fact about the
   * page. Not for prose; that is `subtitle`/`note`.
   *
   * It rides with the title rather than with `actions` because a state is not a control. In the
   * action cluster it was an h-8 chip among h-10 buttons wearing the outline Button's exact
   * resting appearance — the one fact a user opens a record to check, rendered as the quietest
   * thing in the row and reading as a button that does nothing when clicked.
   */
  badge?: React.ReactNode
  crumbs?: Crumb[]
  actions?: React.ReactNode
}

/**
 * The top of every screen below the shell, in three tiers:
 *
 *   breadcrumb   11px eyebrow — where this page sits
 *   title        20px semibold, with the page's actions on the same line
 *   meta         13px muted — what is true about this page right now
 *
 * The meta line carries what is TRUE ABOUT THE PAGE right now, and it is usually empty. It held
 * a record count through two revisions — first as a bare numeral beside the title (which reads as
 * a rendering artifact: no unit, no label, nothing to align with), then phrased as "2 records" a
 * tier down. Both were wrong in the same way: the number was already in the table footer next to
 * the pagination, so the header was restating it in the one place nobody can act on it. A header
 * should say what the page IS, not recount what the content already shows.
 *
 * Three tiers is also the whole hierarchy: anything a screen wants to say that is not one of
 * these belongs to its content, not to its header. The title tier may additionally carry ONE
 * state chip (`badge`) that is an attribute of the title's subject.
 */
export function PageHeader({ title, subtitle, note, badge, crumbs, actions }: PageHeaderProps) {
  // Built as a list so the separators fall out of the join rather than being conditionally
  // rendered — the old `subtitle` and the new count/note used to be three independent branches,
  // which is how a header ends up with a leading "·" the first time one of them is absent.
  const meta: React.ReactNode[] = []
  if (subtitle) meta.push(<span key="subtitle">{subtitle}</span>)
  if (note) meta.push(<span key="note">{note}</span>)
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

      {/* `items-center`, not `items-start`: the actions belong to the TITLE, and aligning them to
          the top of a block whose height depends on whether a meta line happens to be present
          makes the primary button drift up and down between screens. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="min-w-0 font-heading text-2xl leading-snug font-semibold tracking-tight break-words text-foreground">
            {title}
          </h1>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {meta.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {meta.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ·
                </span>
              )}
              {item}
            </Fragment>
          ))}
        </p>
      )}
    </header>
  )
}
