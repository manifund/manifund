'use client'
import { Profile } from '@/db/profile'
import { CommentAndProfileAndRxns } from '@/db/comment'
import { Project } from '@/db/project'
import { CommentsSection } from '@/components/comments/comments-section'

// The project's comments tab: the shared section with the project's specifics.
export function Comments(props: {
  project: Project
  comments: CommentAndProfileAndRxns[]
  commenterContributions: Record<string, string>
  userProfile?: Profile
  userCharityBalance?: number
  specialPrompt?: string
}) {
  const { project, commenterContributions, ...rest } = props
  return (
    <CommentsSection
      target={{ project: project.id }}
      basePath={`/projects/${project.slug}?tab=comments`}
      ownerId={project.creator}
      commenterTags={commenterContributions}
      {...rest}
    />
  )
}
