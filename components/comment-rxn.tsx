import { CommentRxnWithProfile } from '@/db/comment'
import { Popover } from '@headlessui/react'
import { PaperAirplaneIcon } from '@heroicons/react/20/solid'
import { FaceSmileIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './button'
import { InfoTooltip } from './info-tooltip'
import { Col } from './layout/col'
import { Row } from './layout/row'
import { Tooltip } from './tooltip'
import { Avatar } from './avatar'
import { Profile } from '@/db/profile'

export const freeRxns = ['➕', '➖', '🤔', '😮', '🥳', '💡', '❓', '🔥', '👏', '🌈']

export const tippedRxns = {
  '🧡': 1,
  '🏅': 10,
  '🏆': 100,
} as { [key: string]: number }

const AddRxnIcon = (props: { className?: string }) => (
  <div className="relative mt-1 w-5">
    <FaceSmileIcon className="h-5 w-5" />
    <div
      className={clsx(
        'absolute right-0 top-0 rounded-full px-[0.5px] text-[10px] leading-[10px]',
        props.className
      )}
    >
      +
    </div>
  </div>
)

export function AddRxnPopover(props: {
  postRxn: (reaction: string) => void
  rxns: CommentRxnWithProfile[]
  userId: string
  userCharityBalance?: number
  orangeBg?: boolean
}) {
  const { postRxn, rxns, userId, userCharityBalance, orangeBg } = props
  const userRxns = rxns.filter((rxn) => rxn.reactor_id === userId)
  const [selectedTippedRxn, setSelectedTippedRxn] = useState('')
  return (
    <Popover className="relative">
      <Popover.Button className="text-gray-500 hover:text-gray-700 focus:outline-0">
        <AddRxnIcon className={clsx(orangeBg ? 'bg-orange-100' : 'bg-white')} />
      </Popover.Button>

      <Popover.Panel className="absolute bottom-5 left-5 z-10 rounded-md rounded-bl-sm bg-gray-50 p-3 shadow-md">
        <Col className="w-40 gap-1">
          <h3 className="text-sm text-gray-700">Free reactions</h3>
          <div className="mx-auto grid w-fit grid-cols-5 gap-2">
            {freeRxns.map((reaction) => {
              const userDidReact = !!userRxns.find((rxn) => rxn.reaction === reaction)
              return (
                <Popover.Button
                  key={reaction}
                  className="text-base"
                  onClick={async () => {
                    await postRxn(reaction)
                  }}
                >
                  <div
                    className={clsx(
                      'rounded px-1 py-0.5 text-base hover:bg-gray-300',
                      userDidReact && 'bg-gray-200'
                    )}
                  >
                    {reaction}
                  </div>
                </Popover.Button>
              )
            })}
          </div>
        </Col>
        {userCharityBalance !== undefined && (
          <Col className="w-40 gap-1">
            <h3 className="mt-4 text-sm text-gray-700">
              Tipped reactions{' '}
              <InfoTooltip text="Send money from your charity balance to this commenter's charity balance as a thanks for their helpful comment." />
            </h3>
            <Row className="mx-auto justify-between divide-x divide-gray-300">
              {Object.keys(tippedRxns).map((reaction) => {
                const userDidReact = !!userRxns.find((rxn) => rxn.reaction === reaction)
                const sufficientFunds = userCharityBalance >= tippedRxns[reaction]
                const enabled = sufficientFunds && !userDidReact
                return (
                  <div className="px-1" key={reaction}>
                    <Tooltip
                      text={
                        !sufficientFunds ? 'Insufficient funds' : userDidReact ? 'Already used' : ''
                      }
                    >
                      <button
                        key={reaction}
                        disabled={!enabled}
                        onClick={() =>
                          setSelectedTippedRxn(selectedTippedRxn === reaction ? '' : reaction)
                        }
                        className={clsx(
                          enabled ? 'cursor-pointer hover:bg-gray-200' : 'cursor-not-allowed',
                          userDidReact && 'bg-gray-200',
                          reaction === selectedTippedRxn && 'bg-gray-200 ring-2 ring-gray-300',
                          'flex items-center gap-0.5 rounded px-1 py-0.5'
                        )}
                      >
                        <span className="text-xs text-gray-700">${tippedRxns[reaction]}</span>
                        <span className="text-base">{reaction}</span>
                      </button>
                    </Tooltip>
                  </div>
                )
              })}
            </Row>
            {!!selectedTippedRxn && (
              <Row className="mt-2 justify-end">
                <Popover.Button
                  onClick={async () => {
                    await postRxn(selectedTippedRxn)
                    setSelectedTippedRxn('')
                  }}
                  className={clsx(buttonClass('2xs', 'light-orange'), 'flex gap-1')}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Send ${tippedRxns[selectedTippedRxn]} tip
                </Popover.Button>
              </Row>
            )}
          </Col>
        )}
      </Popover.Panel>
    </Popover>
  )
}

export function ExistingFreeRxnsDisplay(props: {
  rxns: CommentRxnWithProfile[]
  postRxn: (reaction: string) => void
  userId?: string
}) {
  const { rxns, postRxn, userId } = props
  const rxnsWithCounts = Object.fromEntries(freeRxns.map((r) => [r, 0]))
  rxns.forEach((rxn) => {
    rxnsWithCounts[rxn.reaction]++
  })
  return (
    <Row className="gap-2">
      {freeRxns.map((reaction) => {
        if (rxnsWithCounts[reaction] > 0) {
          const userDidReact = !!rxns.find(
            (rxn) => rxn.reactor_id === userId && rxn.reaction === reaction
          )
          const reactors = rxns.filter((r) => r.reaction === reaction)
          const numColumns = Math.min(5, Math.ceil(reactors.length / 10))
          const tooltip = (
            <div
              className={clsx(
                'grid gap-1',
                numColumns === 1 && 'grid-cols-1',
                numColumns === 2 && 'grid-cols-2',
                numColumns === 3 && 'grid-cols-3',
                numColumns === 4 && 'grid-cols-4',
                numColumns === 5 && 'grid-cols-5'
              )}
            >
              {reactors.map((r) => (
                <Row key={r.reactor_id} className="items-center gap-1.5">
                  <Avatar
                    username={r.profiles.username}
                    avatarUrl={r.profiles.avatar_url}
                    id={r.profiles.id}
                    size="xxs"
                  />
                  <span className="text-xs">{r.profiles.full_name || r.profiles.username}</span>
                </Row>
              ))}
            </div>
          )
          return (
            <Tooltip text={tooltip} key={reaction} hasSafePolygon>
              <button
                onClick={async () => {
                  if (userId) {
                    await postRxn(reaction)
                  }
                }}
                className={clsx(
                  'flex items-center gap-1 rounded bg-gray-100 px-1.5 py-[0.5px]',
                  userDidReact && 'ring-2 ring-gray-300',
                  userId && 'cursor-pointer hover:bg-gray-200'
                )}
              >
                <span className="text-sm">{reaction}</span>
                {rxnsWithCounts[reaction] > 1 && (
                  <span className="text-xs text-gray-500">{rxnsWithCounts[reaction]}</span>
                )}
              </button>
            </Tooltip>
          )
        } else {
          return null
        }
      })}
    </Row>
  )
}

export function ExistingTippedRxnsDisplay(props: {
  rxns: CommentRxnWithProfile[]
  userId?: string
}) {
  const { rxns, userId } = props
  const tippedRxnsArray = Object.keys(tippedRxns)
  const rxnsWithCounts = Object.fromEntries(tippedRxnsArray.map((r) => [r, 0]))
  rxns.forEach((rxn) => {
    rxnsWithCounts[rxn.reaction]++
  })
  return (
    <Row className="gap-2">
      {tippedRxnsArray.map((reaction) => {
        if (rxnsWithCounts[reaction] > 0) {
          const userDidReact = !!rxns.find(
            (rxn) => rxn.reactor_id === userId && rxn.reaction === reaction
          )
          const reactors = rxns.filter((r) => r.reaction === reaction)
          const numColumns = Math.min(5, Math.ceil(reactors.length / 10))
          const tooltip = (
            <Col className="gap-1.5">
              <div className="text-xs font-medium">${tippedRxns[reaction]} tip</div>
              <div
                className={clsx(
                  'grid gap-1',
                  numColumns === 1 && 'grid-cols-1',
                  numColumns === 2 && 'grid-cols-2',
                  numColumns === 3 && 'grid-cols-3',
                  numColumns === 4 && 'grid-cols-4',
                  numColumns === 5 && 'grid-cols-5'
                )}
              >
                {reactors.map((r) => (
                  <Row key={r.reactor_id} className="items-center gap-1.5">
                    <Avatar
                      username={r.profiles.username}
                      avatarUrl={r.profiles.avatar_url}
                      id={r.profiles.id}
                      size="xxs"
                    />
                    <span className="text-xs">{r.profiles.full_name || r.profiles.username}</span>
                  </Row>
                ))}
              </div>
            </Col>
          )
          return (
            <Tooltip text={tooltip} key={reaction} hasSafePolygon>
              <div
                className={clsx(
                  'flex cursor-default items-center gap-1 rounded bg-gradient-to-r from-orange-500 to-rose-500 px-1.5 py-[0.5px]',
                  userDidReact && 'ring-2 ring-orange-600'
                )}
              >
                <span className="text-sm">{reaction}</span>
                {rxnsWithCounts[reaction] > 1 && (
                  <span className="text-xs text-gray-500">{rxnsWithCounts[reaction]}</span>
                )}
              </div>
            </Tooltip>
          )
        } else {
          return null
        }
      })}
    </Row>
  )
}

export function CommentRxnsPanel(props: {
  commentId: string
  rxns: CommentRxnWithProfile[]
  userId?: string
  userCharityBalance?: number
  orangeBg?: boolean
  userProfile?: Profile
}) {
  const { commentId, rxns, userId, userCharityBalance, orangeBg, userProfile } = props

  const router = useRouter()
  const [localRxns, setLocalRxns] = useState(rxns)
  async function postRxn(reaction: string) {
    const existingRxnIdx = rxns.findIndex(
      (rxn) => rxn.reaction === reaction && rxn.reactor_id === userId
    )
    if (existingRxnIdx === -1) {
      rxns.push({
        comment_id: commentId,
        reaction,
        reactor_id: userId ?? '',
        txn_id: null,
        profiles: userProfile ?? {
          id: userId ?? '',
          username: '',
          avatar_url: '',
          full_name: '',
          created_at: new Date().toISOString(),
          accreditation_status: false,
          bio: '',
          long_description: {},
          mercury_recipient_id: null,
          regranter_status: false,
          mercury_recipient_id: null,
          stripe_connect_id: null,
          type: 'individual',
          website: null,
          id_text: null,
        },
      })
      setLocalRxns(rxns)
    } else {
      rxns.splice(existingRxnIdx, 1)
      setLocalRxns(rxns)
    }
    await fetch(`/api/react-to-comment`, {
      method: 'POST',
      body: JSON.stringify({
        commentId,
        reaction,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    router.refresh()
  }

  return (
    <Row className="items-center gap-2">
      {userId && (
        <AddRxnPopover
          postRxn={postRxn}
          rxns={localRxns}
          userId={userId}
          userCharityBalance={userCharityBalance}
          orangeBg={orangeBg}
        />
      )}
      <ExistingFreeRxnsDisplay rxns={localRxns} userId={userId} postRxn={postRxn} />
      <ExistingTippedRxnsDisplay rxns={localRxns} userId={userId} />
    </Row>
  )
}
