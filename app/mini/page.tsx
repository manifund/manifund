import { FullComment, getRecentFullComments } from '@/db/comment'
import { commentHref } from '@/lib/comments/links'
import { listProjects } from '@/db/project'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getRecentFullTxns } from '@/db/txn'
import { getRecentFullBids } from '@/db/bid'
import { generateText, JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { Link as ExtensionLink } from '@tiptap/extension-link'
import { sortBy } from 'es-toolkit'
import { hotScore } from '@/utils/sort'

type Donation = {
  id: string
  amount: number
  donor: string
  projectTitle: string
  projectSlug: string
  createdAt: string
}

export default async function Minifund() {
  const PAGE_SIZE = 20
  const start = 0

  const supabase = await createServerSupabaseClient()
  const [projects, recentComments, recentDonations, recentBids] = await Promise.all([
    listProjects(supabase),
    getRecentFullComments(supabase, PAGE_SIZE, start),
    getRecentFullTxns(supabase, PAGE_SIZE, start),
    getRecentFullBids(supabase, PAGE_SIZE, start),
  ])

  const projectsToShow = sortBy(projects, [hotScore]).slice(0, 20)

  const donations = recentBids.map((bid) => {
    return {
      id: bid.id,
      amount: bid.amount,
      donor: bid.profiles.full_name || 'Anon',
      projectTitle: bid.projects.title,
      projectSlug: bid.projects.slug,
      createdAt: bid.created_at,
    } as Donation
  })

  // Then add recentDonations too
  recentDonations.forEach((txn) => {
    if (!txn.projects || !txn.profiles || txn.token !== 'USD') {
      return null
    }

    donations.push({
      id: txn.id,
      // Round amount to the nearest dollar
      amount: Math.round(txn.amount),
      donor: txn.profiles.full_name || 'Anon',
      projectTitle: txn.projects.title,
      projectSlug: txn.projects.slug,
      createdAt: txn.created_at,
    })
  })

  // Sort donations by date
  donations.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="p-2 text-sm font-light lowercase">
      <h1 className="my-4 sm:-ml-2">minifund</h1>
      <ol className="list-none">
        {projectsToShow.map((project) => {
          return (
            <li key={project.id} className="mb-0.5">
              <a href={`/projects/${project.slug}`}>
                {project.title}{' '}
                <span className="font-extralight text-gray-600">
                  by {project.profiles.full_name}
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <h1 className="my-4 sm:-ml-2">new comments</h1>
      <ol className="list-none">
        {recentComments.map((comment) => {
          return (
            <li key={comment.id} className="mb-0.5">
              <a href={commentHref(comment)}>
                {comment.profiles.full_name}:{' '}
                <span className="font-extralight text-gray-600">{commentPreview(comment)}</span>
              </a>
            </li>
          )
        })}
      </ol>

      <h1 className="my-4 sm:-ml-2">new donations</h1>
      <ol className="list-none">
        {donations.map((donation) => {
          return (
            <li key={donation.id} className="mb-0.5">
              <a href={`/projects/${donation.projectSlug}`}>
                ${donation.amount} from {donation.donor}
                <span className="font-extralight text-gray-600"> to {donation.projectTitle}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function commentPreview(comment: FullComment) {
  return (
    generateText(comment.content as JSONContent, [StarterKit, TextMention, ExtensionLink]).slice(
      0,
      100
    ) + '...'
  )
}

const TextMention = Mention.extend({
  renderText: ({ node }) => `@${node.attrs.label}`,
})
