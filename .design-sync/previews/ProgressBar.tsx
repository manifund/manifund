import { ProgressBar } from 'manifund'

const Frame = (props: { children: React.ReactNode; label: string }) => (
  <div className="flex w-80 flex-col gap-2">
    {props.children}
    <span className="text-xs text-gray-500">{props.label}</span>
  </div>
)

export const BelowMinimum = () => (
  <Frame label="$4,000 of $40,000 (minimum $10,000)">
    <ProgressBar amountRaised={4000} fundingGoal={40000} minFunding={10000} />
  </Frame>
)

export const PastMinimum = () => (
  <Frame label="$18,500 of $40,000">
    <ProgressBar amountRaised={18500} fundingGoal={40000} minFunding={10000} />
  </Frame>
)

export const FullyFunded = () => (
  <Frame label="$40,000 of $40,000">
    <ProgressBar amountRaised={40000} fundingGoal={40000} minFunding={10000} />
  </Frame>
)

export const Small = () => (
  <Frame label="Small, as used on project cards">
    <ProgressBar amountRaised={62500} fundingGoal={85000} minFunding={30000} small />
  </Frame>
)
