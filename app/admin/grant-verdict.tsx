'use client'

import { Button } from '@/components/button'
import { TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { Row } from '@/components/layout/row'
import { Modal } from '@/components/modal'
import { HorizontalRadioGroup } from '@/components/radio-group'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Input } from '@/components/input'

const REJECT_MESSAGE_INTRO = 'Manifund has declined to fund this project because we believe it'

const DEFAULT_REJECT_MESSAGES = [
  'is outside of our scope in terms of cause area and mission.',
  'is outside of our scope legally.',
  'has downside risks that we believe make it net negative in expectation.',
  'custom',
]

const DEFAULT_PUBLIC_BENEFITS = [
  'AI safety (technical/scientific research)',
  'AI safety (policy research and advocacy)',
  'AI safety (education, outreach, and acceleration)',
  'Biosecurity (technical/scientific research)',
  'Biosecurity (policy research and advocacy)',
  'Animal welfare',
  'Poverty alleviation',
  'Medical research',
  'Public scientific research',
  'Education',
  'Charity education & advocacy',
  'An established 501c3 charity',
  'Other',
]

export function GrantVerdict(props: {
  projectId: string
  lobbying: boolean
  buttonContent?: React.ReactNode
}) {
  const { projectId, lobbying, buttonContent } = props
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [approveGrant, setApproveGrant] = useState(true)
  const [publicBenefitIdx, setPublicBenefitIdx] = useState<number>(0)
  const [publicBenefit, setPublicBenefit] = useState<string>('')
  const [defaultMessage, setDefaultMessage] = useState<string | null>('custom')
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const editor = useTextEditor()
  const verdictOptions = {
    approve: 'Approve',
    reject: 'Reject',
  }

  useEffect(() => {
    if (approveGrant) {
      editor?.commands.setContent('')
    }
  }, [approveGrant])
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size={buttonContent ? '2xs' : undefined}
        color={buttonContent ? 'light-orange' : undefined}
        className={buttonContent ? 'flex items-center' : undefined}
      >
        {buttonContent ?? '🔔'}
      </Button>
      <Modal open={open} setOpen={setOpen}>
        <div className="p-3">
          <h1 className="text-lg font-semibold">Grant verdict</h1>
          {lobbying && <p>🚨 This project involves lobbying 🚨</p>}
          <div>
            <HorizontalRadioGroup
              value={approveGrant ? 'approve' : 'reject'}
              onChange={(event) => setApproveGrant(event === 'approve')}
              options={verdictOptions}
            />
            <div className="my-5">
              <p>Reason for verdict:</p>
              <p className="text-sm text-gray-500">
                This will be posted as an admin comment on the project page. Nothing will be posted
                if this is left empty.
              </p>
              {!approveGrant && (
                <div className="my-5">
                  <fieldset className="mt-2">
                    <legend className="sr-only">Message choice</legend>
                    <div className="space-y-4">
                      {DEFAULT_REJECT_MESSAGES.map((message) => (
                        <Row className="gap-2" key={message}>
                          <input
                            type="radio"
                            value={message}
                            defaultChecked={message === defaultMessage}
                            checked={message === defaultMessage}
                            className="relative top-1 h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
                            onChange={() => {
                              setDefaultMessage(message)
                              editor?.commands.setContent(
                                `<p>Manifund has declined to fund this project because we believe it ${
                                  message === 'custom' ? '...' : message
                                }</p>`
                              )
                            }}
                          />
                          <label>{message}</label>
                        </Row>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
              <TextEditor editor={editor} />
              {approveGrant && (
                <>
                  <p>This grant benefits the public by funding:</p>
                  <div className="mt-1 space-y-4">
                    {DEFAULT_PUBLIC_BENEFITS.map((benefit) => (
                      <Row className="gap-2" key={benefit}>
                        <input
                          type="radio"
                          id={benefit}
                          value={benefit}
                          checked={DEFAULT_PUBLIC_BENEFITS[publicBenefitIdx] === benefit}
                          className="relative top-1 h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
                          onChange={() => {
                            setPublicBenefitIdx(DEFAULT_PUBLIC_BENEFITS.indexOf(benefit))
                            setPublicBenefit(benefit === 'Other' ? '' : benefit)
                          }}
                        />
                        <label htmlFor={benefit}>{benefit}</label>
                      </Row>
                    ))}
                  </div>
                  {DEFAULT_PUBLIC_BENEFITS[publicBenefitIdx] === 'Other' && (
                    <Input
                      placeholder="Other public benefit"
                      className="mt-4 w-full"
                      onChange={(event) => setPublicBenefit(event.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <Row className="justify-between">
            <Button
              color="gray-outline"
              loading={isSubmitting}
              onClick={() => {
                console.log(editor?.getJSON())
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!publicBenefit && approveGrant}
              loading={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true)
                const response = await fetch('/api/issue-grant-verdict', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    approved: approveGrant,
                    projectId: projectId,
                    adminComment: editor?.getHTML() === '<p></p>' ? null : editor?.getJSON(),
                    publicBenefit: approveGrant ? publicBenefit : null,
                  }),
                })
                setIsSubmitting(false)
                if (!response.ok) {
                  const body = await response.json().catch(() => null)
                  toast.error(body?.error ?? 'Failed to issue grant verdict.')
                  return
                }
                const body = await response.json().catch(() => null)
                if (body?.noteError) toast.error(body.noteError, { duration: 15000 })
                setOpen(false)
                router.refresh()
              }}
            >
              Submit
            </Button>
          </Row>
        </div>
      </Modal>
    </>
  )
}
