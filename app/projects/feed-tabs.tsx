'use client'
import { Comment } from '@/components/comment'
import { Col } from '@/components/layout/col'
import { Tabs } from '@/components/tabs'
import { FullTxn } from '@/db/txn'
import Link from 'next/link'
import { FullComment } from '@/db/comment'
import { useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/pagination'
import { useState } from 'react'
import { ProjectsDisplay } from '@/components/projects-display'
import { FullProject } from '@/db/project'
import { SimpleCause } from '@/db/cause'
import { Tag } from '@/components/tags'
import { Card } from '@/components/layout/card'
import { FullBid } from '@/db/bid'
import { Row } from '@/components/layout/row'
import { UserAvatarAndBadge } from '@/components/user-link'
import { RelativeTime } from '@/components/relative-time'

export function FeedTabs(props: {
  recentComments: FullComment[]
  recentDonations: FullTxn[]
  recentBids: FullBid[]
  projects: FullProject[]
  causesList: SimpleCause[]
  userId?: string
}) {
  const { recentComments, recentDonations, recentBids, projects, causesList, userId } = props
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const currentTabId = searchParams.get('tab') ?? 'projects'
  const [page, setPage] = useState(1)

  const ProjectsTab = (
    <ProjectsDisplay projects={projects} defaultSort={'hot'} causesList={causesList} />
  )

  const PaginationWrapper = (
    <Pagination
      page={page}
      itemsPerPage={20}
      totalItems={140}
      setPage={setPage}
      savePageToQuery={true}
    />
  )

  const CommentsTab = (
    <>
      {PaginationWrapper}
      <Col className="gap-8">
        {recentComments.map((comment) => {
          return (
            <Comment
              key={comment.id}
              comment={comment}
              commenter={comment.profiles}
              userId={userId}
              rxns={comment.comment_rxns}
              commentHref={`/projects/${comment.projects.slug}?tab=comments#${comment.id}`}
              projectTitle={comment.projects.title}
            />
          )
        })}
      </Col>
    </>
  )

  // Aggregate donations and bids into a single tab for easier reading
  // Note: sorting/pagination is a bit screwed up (page 2 items don't strictly follow page 1)
  const DonationsTab = (
    <>
      {PaginationWrapper}
      <Col className="gap-8">
        {[
          ...recentDonations.map((txn) => ({
            type: 'donation' as const,
            item: txn,
          })),
          ...recentBids.map((bid) => ({ type: 'bid' as const, item: bid })),
        ]
          .sort((a, b) => {
            return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime()
          })
          .map(({ type, item }) => (
            <Col key={`${type}-${item.id}`}>
              <Link href={`/projects/${item.projects?.slug}`} className="w-fit">
                <Tag text={item.projects?.title ?? ''} className="hover:bg-orange-200" />
              </Link>
              <Card className="rounded-tl-sm !p-1">
                <DonationItem type={type} item={item} />
              </Card>
            </Col>
          ))}
      </Col>
    </>
  )

  return (
    <div>
      <Tabs
        tabs={[
          {
            name: 'Projects',
            id: 'projects',
            display: ProjectsTab,
          },
          {
            name: 'Comments',
            id: 'comments',
            display: CommentsTab,
          },
          {
            name: 'Donations',
            id: 'donations',
            display: DonationsTab,
          },
        ]}
        currentTabId={currentTabId}
      />
      {currentTabId !== 'projects' && PaginationWrapper}
    </div>
  )
}

function DonationItem(props: { type: 'donation' | 'bid'; item: FullTxn | FullBid }) {
  const { type, item } = props
  return (
    <div className="grid w-full grid-cols-3 items-center gap-3 rounded p-3 text-sm">
      <Row className="justify-start">
        {item.profiles && <UserAvatarAndBadge profile={item.profiles} />}
      </Row>
      <Row className="items-center justify-end">
        <div className={type === 'bid' ? 'text-gray-500' : ''}>
          <span title={type === 'bid' ? 'pending donation' : undefined}>
            ${Math.round(item.amount)}
          </span>
        </div>
      </Row>
      <Row className="items-center justify-end gap-2">
        <RelativeTime
          date={item.created_at}
          className="hidden text-right text-gray-500 sm:block"
        />
      </Row>
    </div>
  )
}
