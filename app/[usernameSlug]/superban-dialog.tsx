'use client'
import { useState } from 'react'
import { Modal } from '@/components/modal'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { Profile } from '@/db/profile'
import { useRouter } from 'next/navigation'

export function SuperBanButton(props: {
  profile: Profile
  projectTitles: string[]
  commentCount: number
}) {
  const { profile, projectTitles, commentCount } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700"
      >
        Superban
      </button>
      <SuperBanDialog
        open={open}
        setOpen={setOpen}
        profile={profile}
        projectTitles={projectTitles}
        commentCount={commentCount}
      />
    </>
  )
}

function SuperBanDialog(props: {
  open: boolean
  setOpen: (open: boolean) => void
  profile: Profile
  projectTitles: string[]
  commentCount: number
}) {
  const { open, setOpen, profile, projectTitles: projects, commentCount } = props
  const [confirmText, setConfirmText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canSubmit = confirmText === 'BAN' && !isSubmitting

  async function handleSubmit() {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/superban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to ban user')
      }

      setOpen(false)
      router.push('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} setOpen={setOpen}>
      <Col className="gap-4">
        <h2 className="text-xl font-bold text-red-600">Superban User</h2>
        <p className="text-sm text-gray-600">
          You are about to permanently delete this user and all their content. This action cannot be
          undone.
        </p>

        <div className="rounded-md bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-800">The following will be deleted:</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
            <li>
              <strong>{projects.length}</strong> project
              {projects.length !== 1 ? 's' : ''}
              {projects.length > 0 && (
                <span className="text-red-600">
                  {' '}
                  ({projects.slice(0, 3).join(', ')}
                  {projects.length > 3 && `, +${projects.length - 3} more`})
                </span>
              )}
            </li>
            <li>
              <strong>{commentCount}</strong> comment
              {commentCount !== 1 ? 's' : ''}
            </li>
            <li>
              User profile: <strong>{profile.full_name}</strong> (@
              {profile.username})
            </li>
          </ul>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
            Type <strong>BAN</strong> to confirm
          </label>
          <input
            id="confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            placeholder="BAN"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Row className="justify-end gap-3">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? 'Banning...' : 'Superban User'}
          </button>
        </Row>
      </Col>
    </Modal>
  )
}
