'use client'
import { Profile } from '@/db/profile'
import { formatMoney } from '@/utils/formatting'
import { getAmountRaised, getMinIncludingAmm } from '@/utils/math'
import { FullProject, Project } from '@/db/project'
import Link from 'next/link'
import { ProgressBar } from './progress-bar'
import { Col } from './layout/col'
import {
  ChatBubbleLeftEllipsisIcon,
  ChevronUpDownIcon,
  CheckBadgeIcon,
  CircleStackIcon,
} from '@heroicons/react/20/solid'
import { orderBy } from 'es-toolkit'
import { CauseTag } from './tags'
import { UserAvatarAndBadge } from './user-link'
import { Card } from './layout/card'
import { Row } from './layout/row'
import { Tooltip } from './tooltip'
import { getSponsoredAmount } from '@/utils/constants'
import { AiWrittenIcon } from './slop-flag'

export function ProjectCard(props: { project: FullProject; valuation?: number }) {
  const { project, valuation } = props
  const amountRaised = getAmountRaised(project, project.bids, project.txns)
  // const firstDonorId =
  //   project.stage === 'proposal'
  //     ? orderBy(project.bids, 'created_at', 'asc')[0]?.bidder
  //     : orderBy(project.txns, 'created_at', 'asc')[0]?.from_id
  const regrantorFunded =
    project.txns.some((txn) => txn.from_id && getSponsoredAmount(txn.from_id) > 0) ||
    project.bids.some((bid) => bid.bidder && getSponsoredAmount(bid.bidder) > 0)
  const voteCount = project.project_votes.reduce((acc, vote) => vote.magnitude + acc, 0)
  const minIncludingAmm = getMinIncludingAmm(project)
  const fundingGoal = project.type === 'cert' ? minIncludingAmm : project.funding_goal
  const projectTransfers = project.project_transfers
  const incompleteProjectTransfers = projectTransfers.filter((pt) => !pt.transferred)
  return (
    <Card className="px-4 pb-2 pt-1">
      <Col className="h-full justify-between">
        <ProjectCardHeader
          projectType={project.type}
          creator={project.profiles}
          valuation={project.stage !== 'not funded' ? valuation : undefined}
          regrantorFunded={regrantorFunded}
          aiFraction={project.ai_fraction}
          projectRecipient={
            incompleteProjectTransfers.length > 0
              ? incompleteProjectTransfers[0].recipient_name
              : projectTransfers.length > 0 && !project.profiles.full_name
                ? projectTransfers[0].recipient_name
                : undefined
          }
        />
        <Link
          href={`/projects/${project.slug}`}
          className="group flex h-full flex-col justify-start gap-1 py-2 hover:cursor-pointer"
        >
          <h1 className="text-lg font-medium leading-tight tracking-tight group-hover:underline">
            {project.title}
          </h1>
          <p className="text-xs font-light text-gray-500 sm:text-sm">{project.blurb}</p>
        </Link>
        <Row className="mb-1 flex-wrap gap-1">
          {project.causes?.map((cause) => (
            <CauseTag key={cause.slug} causeTitle={cause.title} causeSlug={cause.slug} />
          ))}
        </Row>
        <Col className="mt-1 gap-1">
          {(project.stage === 'proposal' || project.stage === 'active') && (
            <ProgressBar
              fundingGoal={fundingGoal}
              minFunding={minIncludingAmm}
              amountRaised={amountRaised}
              small
            />
          )}
          <ProjectCardData
            voteCount={voteCount}
            numComments={project.comments.length}
            amountRaised={amountRaised}
            fundingGoal={project.stage === 'proposal' ? fundingGoal : undefined}
            projectSlug={project.slug}
          />
        </Col>
      </Col>
    </Card>
  )
}

function ProjectCardData(props: {
  numComments: number
  voteCount: number
  amountRaised: number
  fundingGoal?: number
  projectSlug: string
}) {
  const { numComments, voteCount, amountRaised, fundingGoal, projectSlug } = props
  return (
    <div className="grid grid-cols-3 text-sm text-gray-400">
      <Row className="justify-start">
        <Tooltip text="Votes" className="flex items-center gap-0">
          <ChevronUpDownIcon className="h-4 w-4 stroke-2" />
          <span>{voteCount}</span>
        </Tooltip>
      </Row>
      <Row className="justify-center">
        <Link href={`/projects/${projectSlug}#tabs`}>
          <Tooltip text="Comments" className="flex items-center gap-1">
            <ChatBubbleLeftEllipsisIcon className="h-4 w-4 stroke-2" />
            <span>{numComments}</span>
          </Tooltip>
        </Link>
      </Row>
      <Row className="justify-end">
        <Tooltip text="Total raised" className="flex items-center gap-0.5">
          <span>
            {formatMoney(amountRaised)}
            {fundingGoal ? ` / ${formatMoney(fundingGoal)}` : ' raised'}
          </span>
        </Tooltip>
      </Row>
    </div>
  )
}

export function ProjectCardHeader(props: {
  creator: Profile
  projectType: Project['type']
  projectRecipient?: string
  valuation?: number
  regrantorFunded?: boolean
  aiFraction?: number | null
}) {
  const { creator, valuation, projectRecipient, projectType, regrantorFunded, aiFraction } = props
  return (
    <Row className="mt-1 items-start justify-between">
      <div>
        <div className="h-1" />
        {projectRecipient ? (
          <span className="relative top-0.5 justify-center text-sm text-gray-500">
            {projectRecipient}
          </span>
        ) : (
          <UserAvatarAndBadge profile={creator} className="text-sm" />
        )}
      </div>
      <Row className="items-center gap-1">
        <AiWrittenIcon aiFraction={aiFraction ?? null} />
        {projectType === 'cert' && valuation && !isNaN(valuation) ? (
          <Tooltip text="valuation">
            <p className="rounded-2xl bg-orange-100 px-2 py-1 text-center text-sm font-medium text-orange-600">
              {formatMoney(valuation)}
            </p>
          </Tooltip>
        ) : null}
        {projectType === 'grant' && regrantorFunded && (
          <Tooltip text="Regrantor funded">
            <CheckBadgeIcon className="relative h-6 w-6 text-orange-500" />
          </Tooltip>
        )}
      </Row>
    </Row>
  )
}

export function CardlessProject(props: {
  project: FullProject
  regrantors?: Profile[]
  showFundingBar?: boolean
}) {
  const { project, regrantors, showFundingBar } = props
  const amountRaised = getAmountRaised(project, project.bids ?? [], project.txns ?? [])
  return (
    <Col className="items-start justify-between gap-3 rounded p-3 hover:bg-gray-100">
      <Row className="flex-2 w-full items-center justify-between gap-3 text-xs">
        <UserAvatarAndBadge profile={project.profiles} className="text-sm text-gray-600" />
        {showFundingBar && (
          <ProgressBar
            amountRaised={amountRaised}
            fundingGoal={project.funding_goal}
            minFunding={project.min_funding}
            small
          />
        )}
        <span className="relative z-10 rounded-full bg-orange-100 px-3 py-1.5 font-medium text-orange-600">
          {formatMoney(regrantors?.length ? amountRaised : project.funding_goal)}
        </span>
      </Row>
      <Link href={`/projects/${project.slug}`}>
        <h3 className="tracking-0 font-semibold leading-6 text-gray-900">{project.title}</h3>
        <p className="mt-1 text-sm leading-5 text-gray-600 lg:line-clamp-2">{project.blurb}</p>
      </Link>
      <Row className="flex-wrap gap-1">
        {project.causes?.map((cause) => (
          <CauseTag key={cause.slug} causeTitle={cause.title} causeSlug={cause.slug} />
        ))}
      </Row>
      {regrantors?.length ? (
        <Row className="flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Regranted by</span>
          {regrantors.map((regrantor) => (
            <UserAvatarAndBadge
              key={regrantor.id}
              profile={regrantor}
              className="text-sm text-gray-600"
            />
          ))}
        </Row>
      ) : null}
    </Col>
  )
}
