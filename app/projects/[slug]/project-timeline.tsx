import { buttonClass } from '@/components/button'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Link from 'next/link'
import { getTimelineSteps, TimelineProps, TimelineStep } from './project-timeline-steps'

// A horizontal track with short labels, and the current step's details once, in a panel
// below. On phones the track keeps only the current step's label.
export function ProjectTimeline(props: TimelineProps) {
  const steps = getTimelineSteps(props)
  // The first unfinished step is the one the creator should act on now.
  const currentIdx = steps.findIndex((step) => !step.complete)
  const current = currentIdx === -1 ? undefined : steps[currentIdx]
  return (
    <nav
      aria-label="Project progress"
      className="mb-5 rounded-xl border border-gray-200 bg-white p-4"
    >
      <ol className="flex">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentIdx
          return (
            <li
              key={step.name}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              <Row className="w-full items-center">
                <Track filled={idx > 0 && steps[idx - 1].complete} hidden={idx === 0} />
                <StepCircle step={step} number={idx + 1} isCurrent={isCurrent} />
                <Track filled={step.complete} hidden={idx === steps.length - 1} />
              </Row>
              <span
                className={clsx(
                  'mt-1.5 text-center text-xs',
                  isCurrent
                    ? 'font-medium text-gray-900'
                    : clsx('hidden sm:block', step.complete ? 'text-gray-500' : 'text-gray-400')
                )}
              >
                {step.short}
              </span>
            </li>
          )
        })}
      </ol>
      {current && (
        <Col
          className={clsx(
            'mt-4 gap-0.5 rounded-lg p-3 sm:p-4',
            current.nonAction ? 'bg-gray-50' : 'bg-orange-50'
          )}
        >
          <p className="text-xs text-gray-500">
            Step {currentIdx + 1} of {steps.length}
            {current.nonAction && ' · waiting on Manifund'}
          </p>
          <p className="font-medium text-gray-900">{current.name}</p>
          <p className="text-sm text-gray-600">{current.details}</p>
          {current.cta && (
            <Link
              href={current.cta.href}
              className={clsx(buttonClass('xs', 'orange'), 'mt-2 self-start')}
            >
              {current.cta.label}
            </Link>
          )}
        </Col>
      )}
    </nav>
  )
}

function Track(props: { filled: boolean; hidden: boolean }) {
  const { filled, hidden } = props
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'h-0.5 flex-1',
        hidden ? 'bg-transparent' : filled ? 'bg-orange-400' : 'bg-gray-200'
      )}
    />
  )
}

function StepCircle(props: { step: TimelineStep; number: number; isCurrent: boolean }) {
  const { step, number, isCurrent } = props
  return (
    <Row
      className={clsx(
        'h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs sm:h-6 sm:w-6',
        step.complete
          ? 'bg-orange-500'
          : isCurrent
            ? 'border-2 border-orange-500 bg-white font-semibold text-orange-600'
            : 'border-2 border-gray-300 bg-white text-gray-400',
        // Dashed ring marks steps that aren't the creator's to act on.
        !step.complete && step.nonAction && 'border-dashed'
      )}
    >
      {step.complete ? <CheckIcon className="h-3.5 w-3.5 text-white" aria-hidden="true" /> : number}
    </Row>
  )
}
