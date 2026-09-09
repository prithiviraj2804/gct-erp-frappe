import { DoctypeEditor } from '@/pages/doctype/form/DoctypeEditor'
import { useDoctypeSchema } from '@/pages/doctype/hooks/use-doctype'
import { useDoctypeRoute } from '@/pages/doctype/hooks/use-doctype-route'
import { DoctypeLinkContext, useDoctypeLinkIndex } from '@/pages/doctype/lib/doctype-links'
import { GOVERNED_NOTICE, writesAllowed } from '@/pages/doctype/lib/governed'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ScreenNotFound } from '@/components/feedback/ScreenNotFound'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordFrame, RecordSkeleton } from '@/pages/doctype/components/RecordFrame'
import { useBrandedDocument, useInstitutionBranding } from '@/hooks/use-branding'

/**
 * A new document of any doctype, from the same schema the list and record screens read.
 *
 * Routed at `/{module}/{doctype}/new`, which React Router ranks above `/{module}/{doctype}/:name`
 * because a static segment always beats a dynamic one. The cost is that a record whose primary
 * key is literally `new` would be unreachable — no naming rule in this app can produce that, and
 * the alternative (`?new` or a separate `/create` prefix) reads worse in every other case.
 */
export default function DoctypeCreatePage() {
  const route = useDoctypeRoute()
  const { data: brand } = useInstitutionBranding()
  const schemaQuery = useDoctypeSchema(route.doctype)
  const linkIndex = useDoctypeLinkIndex()

  const label = route.screenLabel ?? schemaQuery.data?.label ?? 'Record'
  useBrandedDocument(`New ${label}`, brand?.institution ?? null)

  if (route.status === 'pending' || (route.status === 'ready' && schemaQuery.isPending)) {
    return <RecordSkeleton variant="form" />
  }

  if (route.status === 'unknown-module') {
    return (
      <ScreenNotFound thing="Module" body="There is no module at this address, or it is not one of yours." />
    )
  }

  if (route.status === 'unknown-doctype') return <ScreenNotFound />

  const crumbs = [
    { label: route.moduleLabel ?? 'Module', to: route.modulePath },
    { label, to: route.listPath },
    { label: 'New' },
  ]

  if (schemaQuery.isError || !schemaQuery.data) {
    return (
      <RecordFrame>
        <PageHeader title={`New ${label}`} crumbs={crumbs} />
        <div className="mt-(--page-stack)">
          <ErrorState
            error={schemaQuery.error}
            title="Screen unavailable"
            onRetry={() => void schemaQuery.refetch()}
          />
        </div>
      </RecordFrame>
    )
  }

  const schema = schemaQuery.data

  // Two different refusals, told apart because the answers are different: one is "ask your
  // administrator", the other is "use Desk". Collapsing them would send a Trust Admin who holds
  // every permission off to chase a permission they already have.
  const refusal = !writesAllowed(schema)
    ? { title: `${label} is configured per institution`, body: GOVERNED_NOTICE }
    : !schema.permissions.can_create
      ? {
          title: 'You cannot create these',
          // Advisory, exactly as the schema endpoint says it is: this decides whether the form
          // renders, and the framework re-checks on the write regardless. Saying so plainly beats
          // rendering a form whose Save button is guaranteed to 403.
          body: `Your account can read ${label} records but not create them. Ask your administrator.`,
        }
      : null

  if (refusal) {
    return (
      <RecordFrame>
        <PageHeader title={`New ${label}`} crumbs={crumbs} />
        <div className="mt-(--page-stack)">
          <EmptyState title={refusal.title} body={refusal.body} />
        </div>
      </RecordFrame>
    )
  }

  return (
    <DoctypeLinkContext value={linkIndex}>
      <RecordFrame>
        <PageHeader title={`New ${label}`} crumbs={crumbs} />
        <div className="mt-(--page-stack)">
          <DoctypeEditor schema={schema} listPath={route.listPath} label={label} />
        </div>
      </RecordFrame>
    </DoctypeLinkContext>
  )
}
