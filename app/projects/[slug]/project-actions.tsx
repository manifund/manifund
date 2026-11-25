'use client'
import { Menu, Transition } from '@headlessui/react'
import {
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  EyeSlashIcon,
  FireIcon,
  LinkIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import toast from 'react-hot-toast'
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/20/solid'
import { Cause, SimpleCause } from '@/db/cause'
import { FullProject } from '@/db/project'
import { checkReactivateEligible } from '@/utils/activate-project'
import { CloseProject, Edit, HideProject, ProgressUpdate, Reactivate } from './owner-modals'

type ModalId = 'edit' | 'update' | 'close' | 'reactivate' | 'hide'
type MenuItem = { label: string; icon: typeof PencilIcon; onClick: () => void }

const quietButton =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400'

// The project's header actions. Everyone can share; signed-in visitors follow. The owner gets one
// visible button (Edit, or Edit & publish for a draft) and the rarer actions in a "more" menu.
// Admins get the same actions, all in the menu, since they mostly read projects.
export function ProjectActions(props: {
  project: FullProject
  causesList: SimpleCause[]
  prizeCause?: Cause
  signedIn: boolean
  isOwner: boolean
  isAdmin: boolean
  following: boolean
  creatorEmail?: string
}) {
  const { project, causesList, prizeCause, signedIn, isOwner, isAdmin, creatorEmail } = props
  const [modal, setModal] = useState<ModalId | null>(null)
  const control = (id: ModalId) => ({
    open: modal === id,
    setOpen: (open: boolean) => setModal(open ? id : null),
  })
  const canManage = isOwner || isAdmin
  const isDraft = project.stage === 'draft'

  const manageItems: MenuItem[] = !canManage
    ? []
    : [
        ...(!isOwner && !isDraft
          ? [{ label: 'Edit project', icon: PencilIcon, onClick: () => setModal('edit') }]
          : []),
        ...(project.stage === 'active'
          ? [
              { label: 'Post update', icon: PaperAirplaneIcon, onClick: () => setModal('update') },
              { label: 'Close project', icon: LockClosedIcon, onClick: () => setModal('close') },
            ]
          : []),
        ...(checkReactivateEligible(project, prizeCause)
          ? [{ label: 'Reactivate project', icon: FireIcon, onClick: () => setModal('reactivate') }]
          : []),
        // an approved project stays public as the record of what was funded (P7)
        ...(!isDraft && project.stage !== 'hidden' && project.approved !== true
          ? [{ label: 'Hide project', icon: EyeSlashIcon, onClick: () => setModal('hide') }]
          : []),
      ]
  const otherItems: MenuItem[] = creatorEmail
    ? [
        {
          label: 'Copy creator email',
          icon: EnvelopeIcon,
          onClick: async () => {
            await navigator.clipboard.writeText(creatorEmail)
            toast.success('Email copied')
          },
        },
      ]
    : []

  return (
    <div className="flex items-center gap-1">
      {signedIn && !isOwner && <FollowProject projectId={project.id} following={props.following} />}
      <button
        className={quietButton}
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}/projects/${project.slug}`)
          toast.success('Link copied')
        }}
      >
        <LinkIcon className="h-4 w-4" aria-hidden />
        Share
      </button>
      {isOwner &&
        (isDraft ? (
          <Link href={`/projects/${project.slug}/publish`} className={quietButton}>
            <PencilIcon className="h-4 w-4" aria-hidden />
            Edit & publish
          </Link>
        ) : (
          <button className={quietButton} onClick={() => setModal('edit')}>
            <PencilIcon className="h-4 w-4" aria-hidden />
            Edit
          </button>
        ))}
      {(manageItems.length > 0 || otherItems.length > 0) && (
        <MoreMenu groups={[manageItems, otherItems].filter((g) => g.length > 0)} />
      )}
      {canManage && (
        <>
          {!isDraft && <Edit project={project} causesList={causesList} {...control('edit')} />}
          {project.stage === 'active' && (
            <>
              <ProgressUpdate project={project} {...control('update')} />
              <CloseProject projectId={project.id} {...control('close')} />
            </>
          )}
          <Reactivate projectId={project.id} {...control('reactivate')} />
          <HideProject projectId={project.id} {...control('hide')} />
        </>
      )}
    </div>
  )
}

function MoreMenu(props: { groups: MenuItem[][] }) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button aria-label="More actions" className={clsx(quietButton, 'px-1.5')}>
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-20 mt-1 w-52 origin-top-right divide-y divide-gray-100 rounded-lg bg-white py-0 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none">
          {props.groups.map((group, i) => (
            <div key={i} className="py-1">
              {group.map((item) => (
                <Menu.Item key={item.label}>
                  {({ active }) => (
                    <button
                      onClick={item.onClick}
                      className={clsx(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-gray-700',
                        active && 'bg-gray-50 text-gray-900'
                      )}
                    >
                      <item.icon className="h-4 w-4 text-gray-400" aria-hidden />
                      {item.label}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

// Follows the project (its updates reach the viewer's notifications); quiet like Share, orange
// while following.
function FollowProject(props: { projectId: string; following: boolean }) {
  const [following, setFollowing] = useState(props.following)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()
  const Icon = following ? BookmarkSolid : BookmarkOutline
  return (
    <>
      {error && <span className="text-xs text-rose-600">Couldn&apos;t save. Try again.</span>}
      <button
        aria-pressed={following}
        className={clsx(quietButton, following && '!text-orange-600')}
        onClick={async () => {
          if (busy) return
          const before = following
          setFollowing(!before)
          setBusy(true)
          setError(false)
          try {
            const res = await fetch('/api/toggle-follow', {
              method: 'POST',
              body: JSON.stringify({ projectId: props.projectId }),
            })
            if (!res.ok) throw new Error(String(res.status))
            router.refresh()
          } catch {
            setFollowing(before)
            setError(true)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {following ? 'Following' : 'Follow'}
      </button>
    </>
  )
}
