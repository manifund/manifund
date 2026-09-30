'use client'
import { Profile } from '@/db/profile'
import { TxnAndProfiles } from '@/db/txn'
import { formatMoney } from '@/utils/formatting'
import clsx from 'clsx'
import { orderBy, uniq } from 'es-toolkit'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { JSONContent } from '@tiptap/react'
import { Avatar } from './avatar'
import { RightCarrotIcon } from './icons'
import { Row } from './layout/row'
import { UserAvatarAndBadge } from './user-link'
import { TextEditor } from './editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { IconButton } from './button'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { ArrowUturnRightIcon } from '@heroicons/react/24/outline'
import { clearLocalStorageItem } from '@/hooks/use-local-storage'

// `replyContext` adds a "Reply" button to each donation (for any logged-in
// user) that posts a public comment mentioning the donor. Just an ordinary
// top-level comment via /api/post-comment — no special DB machinery.
type ReplyContext = {
  projectId: string
  projectSlug: string
  userProfile?: Profile
}

export function DonationsHistory(props: {
  donations: TxnAndProfiles[]
  replyContext?: ReplyContext
}) {
  const { donations, replyContext } = props
  const sortedDonations = orderBy(donations, ['created_at'], ['desc'])
  return (
    <>
      {donations.length > 0 ? (
        <>
          {sortedDonations.map((txn) => {
            return txn.profiles ? (
              <Donation key={txn.id} txn={txn} replyContext={replyContext} />
            ) : null
          })}
        </>
      ) : (
        <p className="mt-3 text-center italic text-gray-500">No donations yet. Be the first!</p>
      )}{' '}
    </>
  )
}

export function ExpandableDonationsHistory(props: { donations: TxnAndProfiles[] }) {
  const { donations } = props
  const [expanded, setExpanded] = useState(false)
  const sortedDonations = orderBy(donations, ['created_at'], ['desc'])
  const recentDonations = sortedDonations.slice(0, 3)
  const recentDonors = uniq(recentDonations.map((txn) => txn.profiles))
  return (
    <>
      <Row className="flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center text-gray-800">
          <RightCarrotIcon className={clsx('h-4 w-6', expanded && 'rotate-90')} />
          <span className="text-lg">{expanded ? 'Hide donations' : 'Show all donations'}</span>
        </button>
        {!expanded && (
          <Row className="items-center gap-1 text-gray-600">
            recent donations from
            {recentDonors.map((donor) => {
              return donor ? (
                <Avatar
                  key={donor.id}
                  username={donor.username}
                  avatarUrl={donor.avatar_url}
                  id={donor.id}
                  size="xs"
                />
              ) : null
            })}
          </Row>
        )}
      </Row>
      {expanded && <DonationsHistory donations={donations} />}
    </>
  )
}

export function Donation(props: { txn: TxnAndProfiles; replyContext?: ReplyContext }) {
  const { txn, replyContext } = props
  const [replying, setReplying] = useState(false)
  const canReply = !!replyContext?.userProfile
  return (
    <div className="rounded p-2">
      <Row className="justify-between">
        <Row className="items-center gap-1">
          <UserAvatarAndBadge profile={txn.profiles as Profile} />
          <span className="text-gray-600"> donated </span>
          <span>{formatMoney(txn.amount)}</span>
        </Row>
        <Row className="items-center gap-2">
          {canReply && (
            <button
              onClick={() => setReplying((r) => !r)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500"
            >
              <ArrowUturnRightIcon className="h-4 w-4 rotate-180 stroke-2" />
              Reply
            </button>
          )}
          <span className="text-sm text-gray-500">{txn.created_at.slice(0, 10)}</span>
        </Row>
      </Row>
      {replying && canReply && replyContext && (
        <div className="mt-2">
          <DonationReplyBox
            txn={txn}
            replyContext={replyContext}
            onClose={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  )
}

function DonationReplyBox(props: {
  txn: TxnAndProfiles
  replyContext: ReplyContext
  onClose: () => void
}) {
  const { txn, replyContext, onClose } = props
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const donor = txn.profiles as Profile
  const storageKey = `DonationReply${txn.id}`
  // Seed the editor with a mention of the donor so the reply is addressed to
  // them (and they get a mention notification on top of the follower email).
  const startingText: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'mention', attrs: { id: donor.id, label: donor.username } },
          { type: 'text', text: ' ' },
        ],
      },
    ],
  }
  const editor = useTextEditor(
    startingText,
    storageKey,
    `Reply to ${donor.full_name || donor.username}...`,
    'border-0 focus:!outline-none focus:ring-0 text-sm sm:text-md'
  )
  const handleSubmit = async () => {
    const content = editor?.getJSON() as JSONContent | undefined
    if (!editor || !editor.getText()?.trim() || !content) return
    setIsSubmitting(true)
    // Fire-and-forget, matching the normal comment box (comments.tsx): the
    // comment always posts, so we don't surface the response. (/api/post-comment
    // 500s on a redundant follow_project for already-following users, but the
    // insert has already succeeded — no reason to alarm the user or lose their text.)
    await fetch('/api/post-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, projectId: replyContext.projectId }),
    })
    editor.commands.clearContent()
    clearLocalStorageItem(storageKey)
    setIsSubmitting(false)
    onClose()
    router.push(`/projects/${replyContext.projectSlug}?tab=comments`)
    router.refresh()
  }
  return (
    <div className="relative w-full overflow-hidden rounded-xl rounded-tl-sm bg-white p-0 shadow">
      <TextEditor editor={editor}>
        <div className="py-1" aria-hidden="true">
          <div className="py-px">
            <div className="h-9" />
          </div>
        </div>
        <Row className="absolute bottom-0 w-full items-center justify-between border-t border-t-gray-200 bg-white py-0.5 pl-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm text-gray-500 hover:cursor-pointer hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <IconButton
            loading={isSubmitting}
            onClick={async () => {
              await handleSubmit()
            }}
          >
            <PaperAirplaneIcon className="h-6 w-6 text-gray-500 hover:cursor-pointer hover:text-orange-500" />
          </IconButton>
        </Row>
      </TextEditor>
    </div>
  )
}
