import { StageIcon } from 'manifund'

const STAGES = ['draft', 'proposal', 'active', 'complete', 'not funded', 'hidden'] as const

export const Stages = () => (
  <div className="flex gap-6">
    {STAGES.map((stage) => (
      <div key={stage} className="flex flex-col items-center gap-1">
        <StageIcon stage={stage} className="h-6 w-6 text-gray-600" />
        <span className="text-xs text-gray-500">{stage}</span>
      </div>
    ))}
  </div>
)
