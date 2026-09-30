import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { Tooltip } from '@/components/tooltip'

// Wording agreed with the team (2026-09-30).
export const PROFILE_COMMENT_GUIDELINES =
  "Comments on people's pages should be informative. Both vouches and negative appraisals should be phrased professionally and factually where possible."

export function ProfileCommentGuidelines() {
  return (
    <Tooltip text={PROFILE_COMMENT_GUIDELINES} className="inline-block">
      <span className="inline-flex cursor-help items-center gap-1 text-sm font-normal text-gray-500 underline decoration-dotted">
        <InformationCircleIcon className="h-4 w-4" />
        Commenting guidelines
      </span>
    </Tooltip>
  )
}
