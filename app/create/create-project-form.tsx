'use client'

import clsx from 'clsx'
import { useSupabase } from '@/db/supabase-provider'
import { useEffect, useState } from 'react'
import { AmountInput, Input } from '@/components/input'
import { Button } from '@/components/button'
import { useRouter } from 'next/navigation'
import { captureHandledError } from '@/utils/capture-error'
import { TOTAL_SHARES } from '@/db/project'
import { ResetEditor, TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import Link from 'next/link'
import { add, format, isAfter, isBefore } from 'date-fns'
import { Col } from '@/components/layout/col'
import { RequiredStar } from '@/components/tags'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { clearLocalStorageItem } from '@/hooks/use-local-storage'
import { Row } from '@/components/layout/row'
import { Cause, MiniCause, LINK_ONLY_PRIZE_CAUSE_SLUGS } from '@/db/cause'
import { SelectCauses } from '@/components/select-causes'
import { InvestmentStructurePanel } from '@/components/investment-structure'
import { Tooltip } from '@/components/tooltip'
import { SiteLink } from '@/components/site-link'
import { HorizontalRadioGroup } from '@/components/radio-group'
import { Checkbox } from '@/components/input'
import { usePartialUpdater } from '@/hooks/user-partial-updater'
import { ProjectParams } from '@/utils/upsert-project'
import { useSearchParams } from 'next/navigation'
import { Modal } from '@/components/modal'

const DESCRIPTION_OUTLINE = `
<h3>Project summary</h3>
</br>
<h3>What are this project's goals? How will you achieve them?</h3>
</br>
<h3>How will this funding be used?</h3>
</br>
<h3>Who is on your team? What's your track record on similar projects?</h3>
</br>
<h3>What are the most likely causes and outcomes if this project fails?</h3>
</br>
<h3>How much money have you raised in the last 12 months, and from where?</h3>
</br>
`
const DESCRIPTION_KEY = 'ProjectDescription'

export function CreateProjectForm(props: { causesList: Cause[] }) {
  const { causesList } = props
  const [projectParams, updateProjectParams] = usePartialUpdater<ProjectParams>({
    title: '',
    subtitle: '',
    verdictDate: format(add(new Date(), { months: 1 }), 'yyyy-MM-dd'),
    location: '',
    selectedCauses: [],
    selectedPrize: null,
    founderPercent: 50,
    agreedToTerms: false,
    lobbying: false,
  })
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorModalOpen, setErrorModalOpen] = useState<boolean>(false)
  const [errorModalMessage, setErrorModalMessage] = useState<string>('')

  const editor = useTextEditor(DESCRIPTION_OUTLINE, DESCRIPTION_KEY)
  const [madeChanges, setMadeChanges] = useState<boolean>(false)
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.on('update', () => {
        setMadeChanges(true)
      })
    }
  }, [editor])
  useEffect(() => {
    updateProjectParams({
      founderPercent:
        (1 -
          (projectParams.selectedPrize?.cert_params?.defaultInvestorShares ?? 0) / TOTAL_SHARES) *
        100,
    })
    if (!madeChanges) {
      editor?.commands.setContent(
        projectParams.selectedPrize?.project_description_outline ?? DESCRIPTION_OUTLINE
      )
      setMadeChanges(false)
    }
  }, [projectParams.selectedPrize])
  // Causes that are only selectable via a direct ?prize=<slug> link, never shown by default
  const searchParams = useSearchParams()
  const prizeSlug = searchParams?.get('prize')
  const selectablePrizeCauses = causesList.filter(
    (cause) =>
      cause.open &&
      cause.prize &&
      (!LINK_ONLY_PRIZE_CAUSE_SLUGS.includes(cause.slug) || cause.slug === prizeSlug)
  )
  const selectableCauses = causesList.filter((cause) => cause.open && !cause.prize)
  const minMinFunding = projectParams.selectedPrize?.cert_params
    ? projectParams.selectedPrize.cert_params.minMinFunding
    : 500
  const certParams = projectParams.selectedPrize?.cert_params ?? null
  const showMinFunding = !projectParams.selectedPrize || !!certParams?.proposalPhase
  const showFundingGoal = !certParams
  const errorMessage = getCreateProjectErrorMessage(projectParams, minMinFunding)

  const router = useRouter()
  const handleSubmit = async () => {
    if (isSubmitting) return // Prevent multiple simultaneous calls

    setIsSubmitting(true)
    try {
      const finalDescription = editor?.getJSON() ?? '<p>No description</p>'
      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...projectParams,
          description: finalDescription,
        }),
      })

      // Error responses may have an empty or non-JSON body
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          data?.error ||
          `Something went wrong. Your project may have been created — please check your profile before trying again.`
        captureHandledError(new Error(`create-project failed: ${message}`), {
          source: 'create-project',
          status: response.status,
          prize: projectParams.selectedPrize?.slug,
        })
        setErrorModalMessage(message)
        setErrorModalOpen(true)
        return
      }

      router.push(`/projects/${data.slug}`)
      clearLocalStorageItem(DESCRIPTION_KEY)
    } catch (error) {
      console.error('Failed to create project:', error)
      captureHandledError(error, {
        source: 'create-project',
        prize: projectParams.selectedPrize?.slug,
      })
      setErrorModalMessage(
        `Something went wrong. Your project may have been created — please check your profile before trying again.`
      )
      setErrorModalOpen(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  // If ?prize=... param is set, then choose that prize by default
  const selectedPrize = selectablePrizeCauses.find((cause) => cause.slug === prizeSlug)
  useEffect(() => {
    if (selectedPrize) {
      updateProjectParams({ selectedPrize })
    }
  }, [selectedPrize])

  const { session } = useSupabase()
  const user = session?.user
  if (!user) {
    return (
      <div>
        <Link href="/login" className="text-orange-500 hover:text-orange-600">
          Log in
        </Link>{' '}
        to create a project!
      </div>
    )
  }

  return (
    <Col className="gap-4 p-5">
      <Modal open={errorModalOpen} setOpen={setErrorModalOpen}>
        <Col className="gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Error</h2>
          <p className="text-gray-600">{errorModalMessage}</p>
          <Button onClick={() => setErrorModalOpen(false)}>Close</Button>
        </Col>
      </Modal>
      {selectablePrizeCauses.length > 0 && (
        <Col className="gap-1.5">
          <FieldLabel>I am applying for...</FieldLabel>
          <HorizontalRadioGroup
            value={projectParams.selectedPrize?.slug ?? 'grant'}
            onChange={(value) =>
              updateProjectParams({
                selectedPrize:
                  value === 'grant'
                    ? null
                    : (selectablePrizeCauses.find((cause) => cause.slug === value) ?? null),
              })
            }
            options={{
              grant: 'A regular grant',
              ...Object.fromEntries(
                selectablePrizeCauses.map((cause) => [cause.slug, cause.title])
              ),
            }}
          />
          <p className="text-xs text-gray-500">
            Learn more about different funding rounds{' '}
            <SiteLink className="text-orange-500" followsLinkClass href="/causes">
              here
            </SiteLink>
            .
          </p>
        </Col>
      )}
      <SectionDivider label="New proposal" />
      <Col className="gap-1.5">
        <FieldLabel htmlFor="title" required>
          Title
        </FieldLabel>
        <Col>
          <Input
            type="text"
            id="title"
            autoComplete="off"
            maxLength={80}
            value={projectParams.title}
            onChange={(event) => updateProjectParams({ title: event.target.value })}
          />
          <span className="mt-0.5 text-right text-xs tabular-nums text-gray-400">
            {projectParams.title.length}/80 characters
          </span>
        </Col>
      </Col>
      <Col className="gap-1.5">
        <FieldLabel htmlFor="subtitle">Subtitle</FieldLabel>
        <Col>
          <Input
            type="text"
            id="subtitle"
            autoComplete="off"
            maxLength={160}
            value={projectParams.subtitle ?? ''}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              updateProjectParams({ subtitle: event.target.value })
            }
          />
          <span className="mt-0.5 text-right text-xs tabular-nums text-gray-400">
            {(projectParams.subtitle ?? '').length}/160 characters
          </span>
        </Col>
      </Col>
      <Col className="gap-1.5">
        <Row className="items-center justify-between">
          <FieldLabel
            required
            help="Use bullet points, headings, hyperlinks and more. Use Notion-style markdown shortcuts or paste from Google Docs."
          >
            Project description
          </FieldLabel>
          <ResetEditor
            storageKey={DESCRIPTION_KEY}
            editor={editor}
            defaultContent={
              projectParams.selectedPrize?.project_description_outline ?? DESCRIPTION_OUTLINE
            }
          />
        </Row>
        <div className="mb-1 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-600/10">
          <ExclamationTriangleIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <p className="text-sm text-amber-900 [text-wrap:pretty]">
            We recommend writing your proposal in your own words, rather than with an AI; the home
            page filters out projects that are flagged as AI-written.
          </p>
        </div>
        <TextEditor editor={editor} />
      </Col>
      <SectionDivider label="Funding" />
      {(showMinFunding || showFundingGoal) && (
        <div
          className={clsx(
            'grid grid-cols-1 gap-4',
            showMinFunding && showFundingGoal && 'sm:grid-cols-2'
          )}
        >
          {showMinFunding && (
            <Col className="gap-1.5">
              <FieldLabel
                htmlFor="minFunding"
                required
                help={`The minimum amount of funding you need to start this project. If this amount is not reached, no funds will be sent. Due to the cost of approving grants and processing payments, we require this to be at least $${minMinFunding}.`}
              >
                Minimum funding (USD)
              </FieldLabel>
              <AmountInput
                id="minFunding"
                amount={projectParams.minFunding}
                onChangeAmount={(newMin: number | undefined) =>
                  updateProjectParams({ minFunding: newMin })
                }
                placeholder={minMinFunding.toString()}
                error={
                  projectParams.minFunding !== undefined && projectParams.minFunding < minMinFunding
                }
                errorMessage={`Minimum funding must be at least $${minMinFunding}.`}
              />
            </Col>
          )}
          {showFundingGoal && (
            <Col className="gap-1.5">
              <FieldLabel
                htmlFor="fundingGoal"
                required
                help="Until this amount is raised, the project will be marked for donors as not fully funded. If this amount is different from your minimum funding, please explain in your project description what you could accomplish with the minimum funding and what you could accomplish with the full funding."
              >
                Max funding goal (USD)
              </FieldLabel>
              <AmountInput
                id="fundingGoal"
                amount={projectParams.fundingGoal}
                onChangeAmount={(newGoal: number | undefined) =>
                  updateProjectParams({ fundingGoal: Number(newGoal) })
                }
                placeholder={minMinFunding.toString()}
                error={
                  !!(
                    projectParams.fundingGoal &&
                    projectParams.minFunding &&
                    (projectParams.fundingGoal < projectParams.minFunding ||
                      projectParams.fundingGoal <= 0)
                  )
                }
                errorMessage="Funding goal must be greater than 0 and greater than or equal to your minimum funding."
              />
            </Col>
          )}
        </div>
      )}
      {!!certParams && (
        <InvestmentStructurePanel
          minFunding={projectParams.minFunding ?? 0}
          founderPercent={projectParams.founderPercent}
          setFounderPercent={(newPercent: number) =>
            updateProjectParams({ founderPercent: newPercent })
          }
          certParams={certParams}
          agreedToTerms={projectParams.agreedToTerms}
          setAgreedToTerms={(newAgreedToTerms: boolean) => {
            updateProjectParams({ agreedToTerms: newAgreedToTerms })
          }}
        />
      )}
      {showMinFunding && (
        <Col className="gap-1.5">
          <FieldLabel
            required
            help="After this deadline, if you have not reached your minimum funding bar, your application will close and you will not receive any money. This date cannot be more than 6 weeks after posting."
          >
            Decision deadline
          </FieldLabel>
          <Input
            type="date"
            className="sm:max-w-xs"
            value={projectParams.verdictDate ?? ''}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              updateProjectParams({ verdictDate: event.target.value })
            }
          />
        </Col>
      )}
      <SectionDivider label="Logistics" />
      <Col className="gap-1.5">
        <FieldLabel>Cause areas</FieldLabel>
        <SelectCauses
          causesList={selectableCauses}
          selectedCauses={projectParams.selectedCauses}
          setSelectedCauses={(newCauses: MiniCause[]) =>
            updateProjectParams({ selectedCauses: newCauses })
          }
        />
      </Col>

      <Col className="gap-1.5">
        <FieldLabel required>
          What countries are you (and anyone else working on this) based in?
        </FieldLabel>
        <p className="text-xs text-gray-500">
          This is for Manifund operations and will not be published.
        </p>
        <Input
          type="text"
          value={projectParams.location}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            updateProjectParams({ location: event.target.value })
          }
        />
      </Col>

      <Row className="items-center gap-1">
        <label className="flex cursor-pointer items-center">
          <Checkbox
            checked={projectParams.lobbying}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              updateProjectParams({ lobbying: event.target.checked })
            }
          />
          <span className="ml-3 text-sm font-medium text-gray-900">
            This project will engage in{' '}
            <a
              href="https://www.irs.gov/charities-non-profits/lobbying"
              className="text-orange-600 hover:underline"
            >
              lobbying
            </a>
            .
          </span>
        </label>
        <Tooltip
          text="Check this box if you will use this money to lobby (attempt to influence legislation, as defined by the IRS), within the US or internationally."
          className="flex"
        >
          <QuestionMarkCircleIcon
            className="h-4 w-4 cursor-help text-gray-300 transition-colors hover:text-gray-500"
            aria-hidden="true"
          />
        </Tooltip>
      </Row>
      <Tooltip text={errorMessage}>
        <Button
          type="submit"
          className="w-full transition enabled:active:scale-[0.96]"
          disabled={!!errorMessage}
          loading={isSubmitting}
          onClick={handleSubmit}
        >
          Publish project
        </Button>
      </Tooltip>
    </Col>
  )
}

function FieldLabel(props: {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  help?: string
}) {
  const { children, htmlFor, required, help } = props
  return (
    <Row className="items-center gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-900">
        {children}
        {required && <RequiredStar />}
      </label>
      {help && (
        <Tooltip text={help} className="flex">
          <QuestionMarkCircleIcon
            className="h-4 w-4 cursor-help text-gray-300 transition-colors hover:text-gray-500"
            aria-hidden="true"
          />
        </Tooltip>
      )}
    </Row>
  )
}

function SectionDivider(props: { label: string }) {
  const { label } = props
  return (
    <Row className="mt-4 items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </Row>
  )
}

export function getCreateProjectErrorMessage(projectParams: ProjectParams, minMinFunding: number) {
  if (projectParams.title === '') {
    return 'Your project needs a title.'
  } else if (
    projectParams.minFunding === null &&
    (!projectParams.selectedPrize || projectParams.selectedPrize.cert_params?.proposalPhase)
  ) {
    return 'Your project needs a minimum funding amount.'
  } else if (
    projectParams.minFunding !== undefined &&
    projectParams.minFunding < minMinFunding &&
    (!projectParams.selectedPrize || projectParams.selectedPrize.cert_params?.proposalPhase)
  ) {
    return `Your minimum funding must be at least $${minMinFunding}.`
  } else if (
    projectParams.selectedPrize &&
    projectParams.selectedPrize.cert_params?.adjustableInvestmentStructure &&
    !projectParams.agreedToTerms
  ) {
    return 'Please confirm that you agree to the investment structure.'
  } else if (
    projectParams.fundingGoal &&
    !projectParams.selectedPrize &&
    ((projectParams.minFunding && projectParams.minFunding > projectParams.fundingGoal) ||
      projectParams.fundingGoal <= 0)
  ) {
    return 'Your funding goal must be greater than 0 and greater than or equal to your minimum funding goal.'
  } else if (
    isAfter(new Date(projectParams.verdictDate), add(new Date(), { weeks: 6 })) ||
    isBefore(new Date(projectParams.verdictDate), new Date())
  ) {
    return 'Your application close date must be in the future but no more than 6 weeks from now.'
  } else if (
    (!projectParams.selectedPrize || projectParams.selectedPrize.cert_params?.proposalPhase) &&
    !projectParams.verdictDate
  ) {
    return 'You need to set a decision deadline.'
  } else if (!projectParams.location) {
    return 'Please specify the location of your project.'
  } else {
    return null
  }
}
