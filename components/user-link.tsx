import { SiteLink } from './site-link'
import clsx from 'clsx'
import { Tooltip } from './tooltip'
import { Avatar } from './avatar'
import { ShieldCheckIcon, WrenchIcon } from '@heroicons/react/20/solid'
import { MiniProfile } from '@/db/profile'
import { CheckBadgeIcon } from '@heroicons/react/24/outline'

export function shortenName(name: string) {
  const firstName = name.split(' ')[0]
  const maxLength = 11
  const shortName =
    firstName.length >= 3 && name.length > maxLength
      ? firstName.length < maxLength
        ? firstName
        : firstName.substring(0, maxLength - 3) + '...'
      : name.length > maxLength
        ? name.substring(0, maxLength - 3) + '...'
        : name
  return shortName
}

export function UserAvatarAndBadge(props: {
  profile: MiniProfile
  className?: string
  short?: boolean
  creatorBadge?: boolean
}) {
  const { profile, className, short, creatorBadge } = props
  return (
    <div className={clsx('flex flex-row items-center gap-1', className)}>
      <Avatar username={profile.username} avatarUrl={profile.avatar_url} id={profile.id} size={6} />
      <UserLink
        name={profile.full_name}
        username={profile.username}
        short={short}
        creatorBadge={creatorBadge}
      />
    </div>
  )
}

export function UserLink(props: {
  name: string
  username: string
  className?: string
  short?: boolean
  noLink?: boolean
  hideBadge?: boolean
  creatorBadge?: boolean
}) {
  const { name, username, className, short, noLink, hideBadge, creatorBadge } = props
  const shortName = short ? shortenName(name) : name
  const shortened = shortName !== name
  return (
    <SiteLink
      href={`/${username}`}
      className={clsx(
        'inline-flex max-w-[120px] flex-row items-center gap-0.5 truncate min-[480px]:max-w-[220px]',
        className,
        noLink && 'pointer-events-none'
      )}
      followsLinkClass
    >
      <p className="truncate">
        {shortName}
        {shortened ? '...' : ''}
      </p>
      {!hideBadge && <UserBadge username={username} />}
      {creatorBadge && <CreatorBadge />}
    </SiteLink>
  )
}

const microregrantors = [
  '42irrationalist',
  'NoaNabeshima',
  'danwahl',
  'guenael',
  'Jacy',
  'Chris-Lakin',
  'HarveyPowers',
  'aaronl',
  'Kunvar',
  'agucova',
  'toby',
  'Tomohaire',
  'Alyssa',
  'rossry',
  'tfburns',
  'istinetz',
  'casebash',
  'liconstan',
  'marktwse',
  'Jason',
  'pacosta',
  'dominic',
]

const regrantors = [
  'NeelNanda',
  'lisathiergart',
  'joel_bkr',
  'laurenm',
  'gleech',
  'mariushobbhahn',
  'Thomas',
  'Tamay',
  'Richard',
  'RyanKidd',
  'MarcusAbramovitch',
  'ethanjperez',
  'alexandraabates',
]

export function UserBadge(props: { username: string }) {
  const { username } = props

  if (['Austin', 'carol'].includes(username)) {
    return <CoreBadge />
  }
  // if (microregrantors.includes(username)) {
  //   return <MicroregrantorBadge />
  // }
  if (regrantors.includes(username)) {
    return <RegrantorBadge />
  }
  return null
}

// Show a special checkmark next to Core team members
function CoreBadge() {
  return (
    <Tooltip text="I work on Manifund!" placement="right">
      <ShieldCheckIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />
    </Tooltip>
  )
}

function MicroregrantorBadge() {
  return (
    <Tooltip text="Micro-regrantor" placement="right">
      <CheckBadgeIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />
    </Tooltip>
  )
}

function RegrantorBadge() {
  return (
    <Tooltip text="Regrantor" placement="right">
      <CheckBadgeIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />
    </Tooltip>
  )
}

function CreatorBadge() {
  return (
    <Tooltip text="Project creator" placement="right">
      <WrenchIcon className="h-4 w-4 text-blue-500" aria-hidden="true" />
    </Tooltip>
  )
}
