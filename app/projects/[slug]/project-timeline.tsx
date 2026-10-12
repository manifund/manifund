import { buttonClass } from '@/components/button'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { Project } from '@/db/project'
import { formatMoney } from '@/utils/formatting'
import { CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Link from 'next/link'

type TimelineStep = {
  name: string
  description?: string
  complete: boolean
  cta?: { label: string; href: string }
  // Waiting on someone else, not on the creator — drawn with a dashed ring.
  nonAction?: boolean
}

export function ProjectTimeline(props: {
  projectSlug: string
  stage: Project['stage']
  signedAgreement: boolean
  approved: boolean
  reachedMinFunding: boolean
  minFunding: number
  withdrawComplete: boolean
}) {
  const {
    projectSlug,
    stage,
    signedAgreement,
    approved,
    reachedMinFunding,
    minFunding,
    withdrawComplete,
  } = props
  const isDraft = stage === 'draft'
  const steps: TimelineStep[] = [
    {
      name: 'Publish proposal',
      complete: !isDraft,
      cta: { label: 'Edit & publish', href: `/projects/${projectSlug}/publish` },
    },
    {
      name: 'Spread the word',
      description: 'Share your project with people and communities who might fund it.',
      complete: reachedMinFunding,
    },
    {
      name: 'Funding reaches minimum',
      description: `Your project will only pay out if you receive offers adding to at least ${formatMoney(
        minFunding
      )}.`,
      complete: reachedMinFunding,
      nonAction: true,
    },
    {
      name: 'Sign grant agreement',
      complete: signedAgreement,
      cta: { label: 'Review & sign', href: `/projects/${projectSlug}/agreement` },
    },
    {
      name: 'Manifund reviews grant',
      description: 'All grants must be approved by a Manifund admin before they are final.',
      complete: approved,
      nonAction: true,
    },
    {
      name: 'Withdraw funds',
      complete: withdrawComplete,
      cta: { label: 'Enter bank info', href: '/withdraw' },
    },
  ]
  // The first unfinished step is the one the creator should act on now.
  const currentIdx = steps.findIndex((step) => !step.complete)
  return (
    <nav
      aria-label="Project progress"
      className="relative mb-5 rounded-xl border border-gray-300 px-4 pb-4 pt-5"
    >
      <p className="absolute -top-2 left-2 bg-gray-50 px-2 text-xs text-gray-500">Next steps</p>
      {/* Horizontal: connector line across the top, labels underneath. */}
      <ol className="hidden sm:flex">
        {steps.map((step, idx) => (
          <li key={step.name} className="flex min-w-0 flex-1 flex-col">
            <Row className="items-center">
              <Track filled={idx > 0 && steps[idx - 1].complete} hidden={idx === 0} />
              <StepCircle step={step} isCurrent={idx === currentIdx} />
              <Track filled={step.complete} hidden={idx === steps.length - 1} />
            </Row>
            <StepLabel
              step={step}
              isCurrent={idx === currentIdx}
              className="mt-2 items-center px-1 text-center"
            />
          </li>
        ))}
      </ol>
      {/* Vertical on narrow screens, where five columns would be unreadable. */}
      <ol className="flex flex-col sm:hidden">
        {steps.map((step, idx) => (
          <li key={step.name} className="flex flex-col">
            {idx > 0 && (
              <div
                aria-hidden="true"
                className={clsx(
                  'my-1 ml-2 h-4 w-0.5',
                  steps[idx - 1].complete ? 'bg-orange-500' : 'bg-gray-200'
                )}
              />
            )}
            <Row className="items-start gap-2">
              <StepCircle step={step} isCurrent={idx === currentIdx} />
              <StepLabel step={step} isCurrent={idx === currentIdx} />
            </Row>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Square ends so neighbouring segments meet flush instead of pinching.
function Track(props: { filled: boolean; hidden: boolean }) {
  const { filled, hidden } = props
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'h-1 flex-1',
        hidden ? 'bg-transparent' : filled ? 'bg-orange-500' : 'bg-gray-200'
      )}
    />
  )
}

function StepCircle(props: { step: TimelineStep; isCurrent: boolean }) {
  const { step, isCurrent } = props
  return (
    <Row
      className={clsx(
        'h-5 w-5 shrink-0 items-center justify-center rounded-full',
        step.complete
          ? 'bg-orange-600'
          : isCurrent
            ? 'border-2 border-orange-500 bg-white'
            : 'border-2 border-gray-300 bg-white',
        // Dashed ring marks steps that aren't the creator's to act on.
        !step.complete && step.nonAction && 'border-dashed'
      )}
    >
      {step.complete && <CheckIcon className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
    </Row>
  )
}

function StepLabel(props: { step: TimelineStep; isCurrent: boolean; className?: string }) {
  const { step, isCurrent, className } = props
  const textColor = step.complete
    ? 'text-gray-900'
    : isCurrent
      ? 'text-orange-600'
      : 'text-gray-500'
  return (
    <Col className={clsx('gap-1', className)}>
      <span className={clsx('text-sm font-medium', textColor)}>{step.name}</span>
      {/* Descriptions and actions both retire once the step is done. */}
      {!step.complete && step.description && (
        <p className="text-xs text-gray-500">{step.description}</p>
      )}
      {!step.complete && step.cta && (
        <Link
          href={step.cta.href}
          className={clsx(
            // Grayed until this is the step you're actually up to.
            buttonClass('2xs', isCurrent ? 'orange' : 'gray'),
            'mt-0.5 self-start sm:self-auto'
          )}
        >
          {step.cta.label}
        </Link>
      )}
    </Col>
  )
}
