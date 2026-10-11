import { useQuery } from '@tanstack/react-query'
import {
  Building2Icon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDashedIcon,
  LandmarkIcon,
  MapPinIcon,
  SchoolIcon,
} from 'lucide-react'
import { Link } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/frappe'

interface CampusRow {
  name: string
  campus_name: string
}

interface InstitutionRow {
  name: string
  institution_name: string
  institution_type: string
}

interface CampusAssignmentRow {
  name: string
  institution: string
  campus: string
  effective_from: string
  effective_to: string | null
  is_primary: 0 | 1
}

const organizationKeys = { structure: ['organization', 'structure'] as const }

async function fetchStructure() {
  const [campuses, institutions, assignments] = await Promise.all([
    db.getDocList<CampusRow>('Campus', {
      fields: ['name', 'campus_name'],
      filters: [['status', '=', 'Active']],
      limit: 100,
      orderBy: { field: 'campus_name', order: 'asc' },
    }),
    db.getDocList<InstitutionRow>('Institution', {
      fields: ['name', 'institution_name', 'institution_type'],
      filters: [['status', '=', 'Active']],
      limit: 250,
      orderBy: { field: 'institution_name', order: 'asc' },
    }),
    db.getDocList<CampusAssignmentRow>('Institution Campus Assignment', {
      fields: ['name', 'institution', 'campus', 'effective_from', 'effective_to', 'is_primary'],
      filters: [['status', '=', 'Active']],
      limit: 500,
      orderBy: { field: 'effective_from', order: 'asc' },
    }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const currentAssignments = assignments.filter(
    (assignment) =>
      assignment.effective_from <= today &&
      (!assignment.effective_to || assignment.effective_to >= today),
  )
  return { campuses, institutions, assignments: currentAssignments }
}

export function OrganizationOverview() {
  const { data, isPending } = useQuery({
    queryKey: organizationKeys.structure,
    queryFn: fetchStructure,
    staleTime: 60_000,
  })

  if (isPending || !data) return <OrganizationSkeleton />

  const assignedInstitutions = new Set(data.assignments.map((assignment) => assignment.institution))
  const institutionsWithPrimaryCampus = new Set(
    data.assignments
      .filter((assignment) => assignment.is_primary)
      .map((assignment) => assignment.institution),
  )
  const unassignedInstitutions = data.institutions.filter(
    (institution) => !assignedInstitutions.has(institution.name),
  )
  const institutionsWithoutPrimaryCampus = data.institutions.filter(
    (institution) =>
      assignedInstitutions.has(institution.name) &&
      !institutionsWithPrimaryCampus.has(institution.name),
  )

  const setup = [
    { label: 'Trust profile', detail: 'Identity, branding and contact information', complete: true, to: '/master/trust' },
    {
      label: 'Institution types',
      detail: 'Configure the institution categories used by the Trust',
      complete: true,
      to: '/master/institution-type',
    },
    {
      label: 'Campuses',
      detail: 'Add the physical locations operated by the Trust',
      complete: data.campuses.length > 0,
      to: '/master/campus',
    },
    {
      label: 'Institutions',
      detail: 'Register every college and school under the Trust',
      complete: data.institutions.length > 0,
      to: '/master/institution',
    },
    {
      label: 'Campus assignments',
      detail: 'Assign every institution to its operating campuses and select a primary campus',
      complete:
        data.institutions.length > 0 &&
        unassignedInstitutions.length === 0 &&
        institutionsWithoutPrimaryCampus.length === 0,
      to: '/master/institution-campus-assignment',
    },
  ]
  const completed = setup.filter((step) => step.complete).length

  return (
    <div className="flex flex-col gap-(--page-stack)">
      <section className="rounded-xl border border-border bg-card">
        <div className={`flex flex-wrap items-start justify-between gap-4 px-(--card-pad) py-4 ${completed < setup.length ? 'border-b border-border' : ''}`}>
          <div>
            <p className="text-2xs font-semibold tracking-eyebrow text-primary uppercase">
              {completed === setup.length ? 'Organization ready' : 'Foundation setup'}
            </p>
            <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">
              {completed === setup.length ? 'Foundation configured' : 'Build your organization'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {completed === setup.length
                ? 'Trust identity and organizational structure are ready for institution settings.'
                : 'Complete the hierarchy before configuring institution-specific operations.'}
            </p>
          </div>
          {completed === setup.length ? (
            <div className="flex flex-wrap gap-2">
              {setup.map((step) => (
                <Link
                  key={step.label}
                  to={step.to}
                  className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {step.label}
                </Link>
              ))}
            </div>
          ) : (
            <div className="min-w-36">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-medium text-foreground">{completed} of {setup.length}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(completed / setup.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        {completed < setup.length && (
          <ol className="divide-y divide-border">
            {setup.map((step, index) => (
              <li key={step.label}>
                <Link
                  to={step.to}
                  className="group flex items-center gap-3 px-(--card-pad) py-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {step.complete ? (
                    <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <CircleDashedIcon className="size-5 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{step.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {step.complete ? 'Review' : 'Configure'}
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-(--card-pad)">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">Live structure</p>
            <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">Organization hierarchy</h2>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{data.campuses.length} campuses</span>
            <span>{data.institutions.length} institutions</span>
          </div>
        </div>

        <div className="mt-5 border-l border-border pl-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LandmarkIcon className="size-4 text-primary" aria-hidden="true" />
            Trust
          </div>
          <div className="mt-3 space-y-3">
            {data.campuses.map((campus) => {
              const campusAssignments = data.assignments.filter(
                (assignment) => assignment.campus === campus.name,
              )
              const children = campusAssignments.flatMap((assignment) => {
                const institution = data.institutions.find(
                  (candidate) => candidate.name === assignment.institution,
                )
                return institution ? [{ institution, assignment }] : []
              })
              return (
                <div key={campus.name} className="ml-2 border-l border-border pl-5">
                  <Link to={`/master/campus/${campus.name}`} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
                    <MapPinIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {campus.campus_name}
                  </Link>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {children.map(({ institution, assignment }) => (
                      <Link
                        key={assignment.name}
                        to={`/master/institution/${institution.name}`}
                        className="flex items-start gap-2 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary-subtle"
                      >
                        <SchoolIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{institution.institution_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {institution.institution_type}{assignment.is_primary ? ' · Primary campus' : ''}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
            {data.campuses.length === 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                <Building2Icon className="size-5" aria-hidden="true" />
                Add the first campus to begin the organization hierarchy.
              </div>
            )}
            {(unassignedInstitutions.length > 0 || institutionsWithoutPrimaryCampus.length > 0) && (
              <div className="ml-2 rounded-lg border border-dashed border-warning/50 bg-warning-subtle p-4">
                <p className="text-xs font-semibold tracking-eyebrow text-warning uppercase">
                  Campus setup required
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...unassignedInstitutions, ...institutionsWithoutPrimaryCampus].map((institution) => (
                    <Link
                      key={institution.name}
                      to="/master/institution-campus-assignment/new"
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary"
                    >
                      {institution.institution_name}
                      {institutionsWithoutPrimaryCampus.some((item) => item.name === institution.name)
                        ? ' · Select primary'
                        : ' · Assign campus'}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function OrganizationSkeleton() {
  return (
    <div className="space-y-(--page-stack)" role="status">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <span className="sr-only">Loading organization</span>
    </div>
  )
}
