import { Project } from '@/db/project'
import { formatMoney } from '@/utils/formatting'

export type TimelineStep = {
  name: string
  // One line, shown while the step isn't the current one.
  summary: string
  // The full explanation, shown only on the current step.
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
  const min = formatMoney(minFunding)
  return [
    {
      name: 'Publish your proposal',
      summary: 'Make your project visible to funders.',
      details: 'Funders can only find and fund published projects.',
      complete: stage !== 'draft',
      cta: { label: 'Edit & publish', href: `/projects/${projectSlug}/publish` },
    },
    {
      name: 'Sign the grant agreement',
      summary: 'Needed before any money is sent to you.',
      details:
        'Donations are open. Sign the grant agreement now: no money is sent to you until it’s signed.',
      complete: signedAgreement,
      cta: { label: 'Review & sign', href: `/projects/${projectSlug}/agreement` },
    },
    {
      name: 'Spread the word and reach your minimum',
      summary: `Offers need to add up to at least ${min}.`,
      details: `You receive the money only if offers add up to at least ${min}. Share your project with people and communities who might fund it.`,
      complete: reachedMinFunding,
    },
    {
      name: 'Manifund reviews your grant',
      summary: 'An admin approves every grant.',
      details:
        'An admin approves every grant before it’s final. Nothing to do on your side: once it’s approved, the money offered moves to your Manifund balance.',
      complete: approved,
      nonAction: true,
    },
    {
      name: 'Withdraw your funds',
      summary: 'Send the money from your balance to your bank.',
      details:
        'Your funds are in your Manifund balance. Withdraw them to your bank: through Stripe in the US (up to $10,000, within 2 business days), or by bank transfer through Mercury, our bank (within 4 business days).',
      complete: withdrawComplete,
      cta: { label: 'Withdraw funds', href: '/withdraw' },
    },
  ]
}
