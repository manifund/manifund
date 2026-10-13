import { buttonClass } from '@/components/button'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Link from 'next/link'
import { getTimelineSteps, TimelineProps, TimelineStep } from './project-timeline-steps'

// One vertical list for every screen size: each step on one line, and the step the
// creator is on now opened up with its full explanation and button.
export function ProjectTimeline(props: TimelineProps) {
  const steps = getTimelineSteps(props)
  // The first unfinished step is the one the creator should act on now.
  const currentIdx = steps.findIndex((step) => !step.complete)
  return (
    <nav
      aria-label="Project progress"
      className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
    >
      <Row className="mb-4 items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Getting your grant</h2>
        <span className="text-xs text-gray-500">
          {currentIdx === -1 ? 'Done' : `Step ${currentIdx + 1} of ${steps.length}`}
        </span>
      </Row>
      <ol>
        {steps.map((step, idx) => {
          const isCurrent = idx === currentIdx
          return (
            <li
              key={step.name}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {idx < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    'absolute -bottom-1 left-3 top-7 w-0.5 -translate-x-1/2',
                    step.complete ? 'bg-orange-400' : 'bg-gray-200'
                  )}
                />
              )}
              <StepCircle step={step} number={idx + 1} isCurrent={isCurrent} />
              <Col className="min-w-0 flex-1 gap-0.5">
                <span
                  className={clsx(
                    'text-sm leading-6',
                    isCurrent
                      ? 'font-medium text-gray-900'
                      : step.complete
                        ? 'text-gray-700'
                        : 'text-gray-500'
                  )}
                >
                  {step.name}
                </span>
                <p className={clsx('text-sm', isCurrent ? 'text-gray-600' : 'text-gray-400')}>
                  {isCurrent ? step.details : step.summary}
                </p>
                {isCurrent && step.cta && (
                  <Link
                    href={step.cta.href}
                    className={clsx(buttonClass('xs', 'orange'), 'mt-2 self-start')}
                  >
                    {step.cta.label}
                  </Link>
                )}
              </Col>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepCircle(props: { step: TimelineStep; number: number; isCurrent: boolean }) {
  const { step, number, isCurrent } = props
  return (
    <Row
      className={clsx(
        'h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
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
