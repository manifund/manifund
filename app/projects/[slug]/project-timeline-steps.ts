import { Project } from '@/db/project'
import { formatMoney } from '@/utils/formatting'

export type TimelineStep = {
  name: string
  // Label on the track.
  short: string
  // The full explanation, shown in the panel while this is the current step.
  details: string
  complete: boolean
  cta?: { label: string; href: string }
  // Waiting on someone else, not on the creator — drawn with a dashed ring.
  nonAction?: boolean
}

export type TimelineProps = {
  projectSlug: string
  stage: Project['stage']
  signedAgreement: boolean
  approved: boolean
  reachedMinFunding: boolean
  minFunding: number
  withdrawComplete: boolean
}

export function getTimelineSteps(props: TimelineProps): TimelineStep[] {
  const {
    projectSlug,
    stage,
    signedAgreement,
    approved,
    reachedMinFunding,
    minFunding,
    withdrawComplete,
  } = props
  return [
    {
      name: 'Publish your proposal',
      short: 'Publish',
      details: 'Funders can only find and fund published projects.',
      complete: stage !== 'draft',
      cta: { label: 'Edit & publish', href: `/projects/${projectSlug}/publish` },
    },
    {
      name: 'Sign the grant agreement',
      short: 'Sign',
      details:
        'Donations are open. Sign the grant agreement now: no money is sent to you until it’s signed.',
      complete: signedAgreement,
      cta: { label: 'Review & sign', href: `/projects/${projectSlug}/agreement` },
    },
    {
      name: 'Spread the word and reach your minimum',
      short: 'Reach minimum',
      details: `You receive the money only if offers add up to at least ${formatMoney(minFunding)}. Share your project with people and communities who might fund it.`,
      complete: reachedMinFunding,
    },
    {
      name: 'Manifund reviews your grant',
      short: 'Review',
      details:
        'An admin approves every grant before it’s final. Nothing to do on your side: once it’s approved, the money offered moves to your Manifund balance.',
      complete: approved,
      nonAction: true,
    },
    {
      name: 'Withdraw your funds',
      short: 'Withdraw',
      details:
        'Your funds are in your Manifund balance. Withdraw them to your bank: through Stripe in the US (up to $10,000, within 2 business days), or by bank transfer through Mercury, our bank (within 4 business days).',
      complete: withdrawComplete,
      cta: { label: 'Withdraw funds', href: '/withdraw' },
    },
  ]
}
