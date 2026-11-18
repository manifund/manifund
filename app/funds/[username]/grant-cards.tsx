import Link from 'next/link'
import clsx from 'clsx'
import { ProjectCard } from '@/components/project-card'
import { Avatar } from '@/components/avatar'
import { formatMoney } from '@/utils/formatting'
import { FullProject } from '@/db/project'

export type GrantAmount = { granted: number; offered: number; latest: string }
export type GrantComment = {
  href: string
  author: { id: string; username: string; full_name: string; avatar_url: string | null }
  excerpt: string
}

// Like ProjectGroup, with a band above each card saying what the fund gave or offered (F5),
// and below it the admin's comment on the grant (F11). The band links to that comment.
export function GrantCards(props: {
  projects: FullProject[]
  amounts: Record<string, GrantAmount>
  comments: Record<string, GrantComment>
}) {
  const { projects, amounts, comments } = props
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 font-normal">
      {projects.map((project) => {
        const { granted, offered } = amounts[project.id]
        const comment = comments[project.id]
        return (
          <div key={project.id} className="flex flex-col">
            <Link
              href={comment?.href ?? `/projects/${project.slug}`}
              className="w-fit rounded-t-md bg-amber-100 px-2.5 py-1 text-sm font-light text-amber-950 hover:bg-amber-200"
            >
              {granted > 0 && (
                <>
                  <span className="font-medium">{formatMoney(granted)}</span> granted
                </>
              )}
              {granted > 0 && offered > 0 && ', '}
              {offered > 0 && (
                <>
                  <span className="font-medium">{formatMoney(offered)}</span> offered, pending
                </>
              )}
            </Link>
            <div
              className={clsx(
                'flex-1 [&>*]:h-full [&>*]:rounded-tl-none',
                comment && '[&>*]:rounded-b-none'
              )}
            >
              <ProjectCard project={project} />
            </div>
            {comment && (
              <Link
                href={comment.href}
                className="group flex flex-col gap-1.5 rounded-b-md border-t border-amber-100 bg-amber-50 px-4 py-3 text-sm shadow-sm"
              >
                <span className="flex items-center gap-2 text-gray-500">
                  <Avatar
                    username={comment.author.username}
                    avatarUrl={comment.author.avatar_url}
                    id={comment.author.id}
                    size={5}
                    noLink
                  />
                  <span className="font-medium text-gray-900">{comment.author.full_name}</span>
                  on the grant
                </span>
                {comment.excerpt && (
                  <span className="line-clamp-3 font-light leading-snug text-gray-700">
                    {comment.excerpt}
                  </span>
                )}
                <span className="text-orange-600 group-hover:underline">Read the comment →</span>
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
