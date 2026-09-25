'use client'
import { ResetEditor, TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { AmountInput, Checkbox, Input } from '@/components/input'
import { Col } from '@/components/layout/col'
import { useEffect, useState } from 'react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Combobox } from '@headlessui/react'
import clsx from 'clsx'
import { MiniProfile } from '@/db/profile'
import { Row } from '@/components/layout/row'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/button'
import { useRouter } from 'next/navigation'
import { HorizontalRadioGroup } from '@/components/radio-group'
import { RequiredStar } from '@/components/tags'
import { clearLocalStorageItem } from '@/hooks/use-local-storage'
import { Tooltip } from '@/components/tooltip'
import { SelectCauses } from '@/components/select-causes'
import { MiniCause, SimpleCause } from '@/db/cause'
import { isEmailValid } from '@/utils/parse'

const DESCRIPTION_OUTLINE = `
<h3>Project summary</h3>
</br>
<h3>What are this project's goals and how they be achieved?</h3>
</br>
<h3>How will this funding be used?</h3>
</br>
<h3>Who is on the team and what's their track record on similar projects?</h3>
</br>
<h3>What are the most likely causes and outcomes if this project fails? (premortem)</h3>
</br>
<h3>What other funding is this person or project getting?</h3>
</br>
`
const DESCRIPTION_KEY = 'GrantDescription'

const REASONING_OUTLINE = `
<h3>Main points in favor of this grant</h3>
</br>
<h3>Donor's main reservations</h3>
</br>
<h3>Process for deciding amount</h3>
</br>
<h3>Conflicts of interest</h3>
<p>Please disclose e.g. any romantic, professional, financial, housemate, or familial relationships you have with the grant recipient(s).</p>
</br>
`
const REASONING_KEY = 'GrantReasoning'

export function CreateGrantForm(props: {
  profiles: MiniProfile[]
  causesList: SimpleCause[]
  maxDonation: number
}) {
  const { profiles, maxDonation, causesList } = props
  const [query, setQuery] = useState('')
  const filteredProfiles =
    query === ''
      ? profiles
      : profiles.filter((profile) => {
          return (
            profile.full_name.toLowerCase().includes(query.toLowerCase()) ||
            profile.username.toLowerCase().includes(query.toLowerCase())
          )
        })
  const [recipientOnManifund, setRecipientOnManifund] = useState(false)
  const [recipient, setRecipient] = useState<MiniProfile | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientFullName, setRecipientFullName] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [fundingOption, setFundingOption] = useState('fullyFund')
  const [donorContribution, setDonorContribution] = useState<number>()
  const [fundingGoal, setFundingGoal] = useState<number>()
  const [minFunding, setMinFunding] = useState<number>()
  const [selectedCauses, setSelectedCauses] = useState<MiniCause[]>([])
  const [locationDescription, setLocationDescription] = useState('')
  const [lobbying, setLobbying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const descriptionEditor = useTextEditor(DESCRIPTION_OUTLINE, DESCRIPTION_KEY)
  const reasoningEditor = useTextEditor(REASONING_OUTLINE, REASONING_KEY)
  const router = useRouter()

  const selectableCauses = causesList.filter((cause) => cause.open && !cause.prize)

  const fundingOptions = {
    fullyFund: 'be fully funded',
    moreRoom: 'have room for more funding',
    needsMore: 'need more funding',
  }

  let recipientDoesExistError = false
  if (!recipientOnManifund) {
    if (
      profiles.find(
        (profile) => profile.full_name === recipientFullName && recipientFullName !== ''
      )
    ) {
      recipientDoesExistError = true
    } else {
      recipientDoesExistError = false
    }
  }
  useEffect(() => {
    if (recipientOnManifund) {
      recipientDoesExistError = false
      setRecipient(profiles.find((profile) => profile.full_name === recipientFullName) ?? null)
    }
  }, [recipientOnManifund, recipientFullName, profiles])

  useEffect(() => {
    if (fundingOption === 'fullyFund') {
      setFundingGoal(donorContribution)
      setMinFunding(donorContribution)
    } else if (fundingOption === 'moreRoom') {
      setMinFunding(donorContribution)
    }
  }, [fundingOption, donorContribution])

  let errorMessage = null
  if (!recipientOnManifund && !recipientFullName) {
    errorMessage = 'Please enter the name of the recipient.'
  } else if (!recipientOnManifund && !recipientEmail) {
    errorMessage = 'Please enter the email address of the recipient.'
  } else if (!recipientOnManifund && !isEmailValid(recipientEmail)) {
    errorMessage = 'Invalid recipient email address.'
  } else if (recipientOnManifund && recipient === null) {
    errorMessage = 'Please select the recipient.'
  } else if (!title) {
    errorMessage = 'Please enter a title for your grant.'
  } else if (!donorContribution || donorContribution <= 0) {
    errorMessage = 'Please enter a positive donation amount.'
  } else if (!minFunding || minFunding <= 0) {
    errorMessage = 'Please enter a positive minimum funding amount.'
  } else if (
    fundingGoal &&
    donorContribution &&
    fundingOption !== 'fullyFund' &&
    fundingGoal <= donorContribution
  ) {
    errorMessage =
      'The funding goal must be greater than your contribution. Otherwise, indicate that the project will be fully funded.'
  } else if (
    fundingGoal &&
    minFunding &&
    fundingOption === 'needsMore' &&
    fundingGoal <= minFunding
  ) {
    errorMessage = 'The funding goal must be greater than the minimum funding.'
  } else if (fundingOption === 'needsMore' && minFunding <= donorContribution) {
    errorMessage =
      'The minimum funding must be greater than your contribution. Otherwise, indicate that the project does not need more funding.'
  } else if (maxDonation < donorContribution) {
    errorMessage = `You currently have $${maxDonation} to give. If you would like to give a larger grant, you can add money to your account or raise more funds from other users on Manifund.`
  } else if (!locationDescription) {
    errorMessage = 'Please enter the location description.'
  } else {
    errorMessage = null
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const description = descriptionEditor?.getJSON()
    const donorNotes = reasoningEditor?.getJSON()
    const response = await fetch('/api/create-grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        subtitle,
        description,
        donorNotes,
        donorContribution,
        fundingGoal,
        minFunding,
        recipientEmail: recipientOnManifund ? undefined : recipientEmail,
        recipientName: recipientOnManifund ? undefined : recipientFullName,
        recipientUsername: recipientOnManifund ? recipient?.username : undefined,
        causeSlugs: selectedCauses.map((cause) => cause.slug),
        locationDescription,
        lobbying,
      }),
    })
    const newProject = await response.json()
    router.push(`/projects/${newProject.slug}`)
    clearLocalStorageItem(DESCRIPTION_KEY)
    clearLocalStorageItem(REASONING_KEY)
    setIsSubmitting(false)
  }
  return (
    <Col className="gap-5 p-4">
      <div>
        <h1 className="text-2xl font-bold">Create grant</h1>
        <span className="my-1 text-sm text-gray-600">
          Use this form to give a grant for a project that is not already posted on Manifund. Note
          that all grants are public.{' '}
        </span>
        <span className="my-1 text-sm text-gray-600">
          We expect this writeup to take 0.5-2 hours, and ask that you take less time and include
          fewer details for small grants and spend more time and include more details for large
          grants.
        </span>
      </div>
      <Row
        className={clsx(
          recipientDoesExistError ? 'rounded-md border-2 border-rose-500 bg-rose-100 p-1' : ''
        )}
      >
        <Checkbox
          id="terms"
          aria-describedby="terms-description"
          name="terms"
          checked={recipientOnManifund}
          onChange={() => setRecipientOnManifund(!recipientOnManifund)}
        />
        <span className="ml-2 leading-6 text-gray-900">
          Recipient is already a user on Manifund.
        </span>
      </Row>
      {!recipientOnManifund && (
        <>
          <Col className="gap-1">
            <label htmlFor="recipientFullName">
              Recipient full name
              <RequiredStar />
            </label>
            <Input
              type="text"
              id="recipientFullName"
              value={recipientFullName}
              onChange={(event) => setRecipientFullName(event.target.value)}
            />
            {recipientDoesExistError && (
              <span className="text-sm text-rose-500">
                This person is already a user on Manifund.
              </span>
            )}
          </Col>
          <Col className="gap-1">
            <label htmlFor="recipientEmail">
              Recipient email
              <RequiredStar />
            </label>
            <Input
              type="text"
              id="recipientEmail"
              error={!isEmailValid(recipientEmail) && recipientEmail !== ''}
              errorMessage={'Invalid email'}
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </Col>
        </>
      )}
      {recipientOnManifund && (
        <Col className="gap-1">
          <label>
            Recipient
            <RequiredStar />
          </label>
          <Combobox as="div" value={recipient} onChange={setRecipient}>
            <div className="relative">
              <Combobox.Input
                className="invalid:border-scarlet-500 invalid:text-scarlet-900 invalid:placeholder-scarlet-300 h-12 w-full rounded-md border border-gray-300 bg-white px-4 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500"
                onChange={(event) => setQuery(event.target.value)}
                displayValue={(profile: MiniProfile | null) => profile?.full_name ?? ''}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </Combobox.Button>
              {filteredProfiles.length > 0 && (
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {filteredProfiles.map((profile) => (
                    <Combobox.Option
                      key={profile.username}
                      value={profile}
                      className={({ active }) =>
                        clsx(
                          'relative cursor-default select-none py-2 pl-3 pr-9',
                          active ? 'bg-orange-500 text-white' : 'text-gray-900'
                        )
                      }
                    >
                      {({ active, selected }) => (
                        <>
                          <Row className="gap-2">
                            <Avatar
                              avatarUrl={profile.avatar_url}
                              username={profile.username}
                              id={profile.id}
                              size={'xs'}
                              className="relative bottom-0.5"
                            />
                            <span className={clsx('truncate', selected && 'font-semibold')}>
                              {profile.full_name}
                            </span>
                            <span
                              className={clsx(
                                'truncate text-gray-500',
                                active ? 'text-orange-100' : 'text-gray-500'
                              )}
                            >
                              @{profile.username}
                            </span>
                          </Row>
                          {selected && (
                            <span
                              className={clsx(
                                'absolute inset-y-0 right-0 flex items-center pr-4',
                                active ? 'text-white' : 'text-orange-500'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                </Combobox.Options>
              )}
            </div>
          </Combobox>
        </Col>
      )}
      <Col className="gap-1">
        <label htmlFor="title">
          Title
          <RequiredStar />
        </label>
        <Col>
          <Input
            type="text"
            id="title"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <span className="text-right text-xs text-gray-600">Maximum 80 characters</span>
        </Col>
      </Col>
      <Col className="gap-1">
        <label htmlFor="subtitle">Subtitle</label>
        <Col>
          <Input
            type="text"
            id="subtitle"
            maxLength={160}
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
          />
          <span className="text-right text-xs text-gray-600">Maximum 160 characters</span>
        </Col>
      </Col>
      <Col className="gap-1">
        <label>After recieving this grant, this project will...</label>
        <HorizontalRadioGroup
          value={fundingOption}
          onChange={(event) => setFundingOption(event)}
          options={fundingOptions}
          wide
        />
      </Col>
      <Col className="gap-1">
        <label htmlFor="donorContribution">
          Your contribution (USD)
          <RequiredStar />
        </label>
        <AmountInput
          id="donorContribution"
          amount={donorContribution}
          onChangeAmount={setDonorContribution}
          error={!!(donorContribution && maxDonation < donorContribution)}
          errorMessage={`You currently have $${maxDonation} to give away. If you would like to
          give a larger grant, you can add money to your account or raise more
          funds from other users on Manifund.`}
        />
      </Col>
      {fundingOption === 'needsMore' && (
        <Col className="gap-1">
          <label htmlFor="amount">
            Minimum funding (USD) <RequiredStar />
          </label>
          <span className="text-sm text-gray-600">
            No money will be transferred until this amount has been raised.
          </span>
          <AmountInput id="minFunding" amount={minFunding} onChangeAmount={setMinFunding} />
        </Col>
      )}
      {fundingOption !== 'fullyFund' && (
        <Col className="gap-1">
          <label htmlFor="amount">
            Funding goal (USD) <RequiredStar />
          </label>
          <span className="text-sm text-gray-600">
            Until this amount is raised, the project will be marked to other donors as not fully
            funded.
          </span>
          <AmountInput
            id="fundingGoal"
            amount={fundingGoal}
            onChangeAmount={setFundingGoal}
            error={!!(fundingGoal && donorContribution && fundingGoal <= donorContribution)}
            errorMessage="The funding goal must be greater than your contribution. Otherwise, indicate that the project will be fully funded."
          />
        </Col>
      )}
      <Col className="gap-1">
        <Row className="items-center justify-between">
          <label>
            Project description
            <RequiredStar />
          </label>
          <ResetEditor
            storageKey={DESCRIPTION_KEY}
            editor={descriptionEditor}
            defaultContent={DESCRIPTION_OUTLINE}
          />
        </Row>
        <span className="text-sm text-gray-600">
          This will be displayed as the public description of this project, but can be edited by the
          grant recipient. In this section, please describe in objective terms the nature of the
          project.
        </span>
        <TextEditor editor={descriptionEditor} />
      </Col>
      <Col className="gap-1">
        <Row className="items-center justify-between">
          <label>
            Grantmaker notes & reasoning
            <RequiredStar />
          </label>
          <ResetEditor
            storageKey={REASONING_KEY}
            editor={reasoningEditor}
            defaultContent={REASONING_OUTLINE}
          />
        </Row>
        <span className="text-sm text-gray-600">
          This will be displayed as a public comment on this project. In this section, please
          describe in subjective terms why you are excited to fund this project.
        </span>
        <TextEditor editor={reasoningEditor} />
      </Col>
      <Col className="gap-1">
        <label>Cause areas</label>
        <SelectCauses
          causesList={selectableCauses}
          selectedCauses={selectedCauses}
          setSelectedCauses={setSelectedCauses}
        />
      </Col>
      <Col className="gap-1">
        <label>
          In what countries are the grantee and anyone else working on this project located?
          <RequiredStar />
        </label>
        <p className="text-sm text-gray-600">
          This is for Manifund operations and will not be published.
        </p>
        <Input
          type="text"
          value={locationDescription}
          onChange={(event) => setLocationDescription(event.target.value)}
        />
      </Col>
      <Row className="items-start">
        <Checkbox checked={lobbying} onChange={(event) => setLobbying(event.target.checked)} />
        <span className="ml-3 mt-0.5 text-sm leading-tight">
          <span className="font-bold">
            This project will engage in{' '}
            <a
              href="https://www.irs.gov/charities-non-profits/lobbying"
              className="text-orange-600 hover:underline"
            >
              lobbying
            </a>
            .
          </span>
          <span>
            {' '}
            Check this box if this project will involve any lobbying activities, in the US or
            internationally.
          </span>
          <RequiredStar />
        </span>
      </Row>
      <Tooltip text={errorMessage}>
        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={errorMessage !== null}
          loading={isSubmitting}
          onClick={handleSubmit}
        >
          Create grant
        </Button>
      </Tooltip>
    </Col>
  )
}
