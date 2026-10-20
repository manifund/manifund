import { AiTrophy } from '@/components/ai-trophy'
import { AiEvalScore } from '@/utils/karma'
import { format } from 'date-fns'

export function AiReview(props: { evaluation: AiEvalScore & { opinion?: string | null } }) {
  const { evaluation } = props
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-2">
        <AiTrophy />
        <span className="font-semibold text-gray-900">Rated {evaluation.score} out of 5</span>
      </div>
      <p className="whitespace-pre-line text-sm text-gray-900">{evaluation.opinion}</p>
      <p className="text-xs text-gray-500">
        {`Written by Claude Opus 5.5 on ${format(new Date(evaluation.created_at), 'MMM d, yyyy')} as part of our experimental AI rating system.`}
      </p>
    </div>
  )
}
