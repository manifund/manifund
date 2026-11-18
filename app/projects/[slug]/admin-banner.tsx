'use client'
import { FullProject } from '@/db/project'
import { GrantVerdict } from '@/app/admin/grant-verdict'
import { BidAndProfile } from '@/db/bid'
import { getAmountRaised, getMinIncludingAmm } from '@/utils/math'
import { TxnAndProfiles } from '@/db/txn'
import { ShieldCheckIcon } from '@heroicons/react/20/solid'
import { LeoGrantButton } from './leo-grant-button'

// Admin work this project is waiting on, above the header rather than among the page's own
// buttons: a verdict once a proposal reaches its minimum (as /admin/approvals lists them), and
// Leo's offer for his microgrants.
export function AdminBanner(props: {
  project: FullProject
  projectBids: BidAndProfile[]
  projectTxns: TxnAndProfiles[]
}) {
  const { project, projectBids, projectTxns } = props
  const amountRaised = getAmountRaised(project, projectBids, projectTxns)
  const needsApproval =
    project.stage === 'proposal' &&
    project.approved === null &&
    amountRaised >= getMinIncludingAmm(project)
  const isLeoMicrogrant = project.causes.some((cause) => cause.slug === 'leo-microgrants')
  if (!needsApproval && !isLeoMicrogrant) return null

  return (
    <div
      id="admin-actions"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
    >
      <ShieldCheckIcon className="h-4 w-4 flex-none text-amber-600" aria-hidden />
      <span className="min-w-0 flex-1">
        {needsApproval
          ? 'This proposal reached its minimum funding and is waiting for an admin verdict.'
          : 'This is one of Leo’s microgrants.'}
      </span>
      <div className="flex items-center gap-2">
        {needsApproval && (
          <GrantVerdict
            projectId={project.id}
            lobbying={project.lobbying}
            buttonContent="Approve or reject"
          />
        )}
        {isLeoMicrogrant && <LeoGrantButton projectId={project.id} />}
      </div>
    </div>
  )
}
