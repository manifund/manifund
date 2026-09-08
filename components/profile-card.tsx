import { Profile } from '@/db/profile'
import clsx from 'clsx'
import { Card } from './layout/card'
import Link from 'next/link'
import { Avatar } from './avatar'
import { Row } from './layout/row'
import { Col } from './layout/col'
import { addHttpToUrl, formatMoney } from '@/utils/formatting'
import { LinkIcon } from '@heroicons/react/20/solid'
import { SponsoredTag } from './tags'

export function ProfileCard(props: {
  profile: Profile
  sponsoredAmount: number
  className?: string
}) {
  const { profile, sponsoredAmount, className } = props
  return (
    <Card className={clsx('relative flex h-full flex-col gap-4 border-none py-3', className)}>
      <Row className="items-center justify-between">
        {sponsoredAmount !== 0 && (
          <SponsoredTag
            text={`${formatMoney(sponsoredAmount)}`}
            className="absolute left-3 top-3"
          />
        )}
        {profile.website && (
          <Link href={addHttpToUrl(profile.website)}>
            <LinkIcon className="h-5 w-5 rounded bg-gray-100 stroke-2 p-1 text-gray-600 hover:bg-gray-200" />
          </Link>
        )}
      </Row>
      <Link href={`/${profile.username}`} className="flex h-full flex-col">
        <Row className="mb-3 mt-2 justify-center">
          <Avatar
            avatarUrl={profile.avatar_url}
            username={profile.username}
            size={24}
            id={profile.id}
            className="shadow-md"
          />
        </Row>
        <Col className="flex h-full w-full flex-col gap-1">
          <span className="text-center font-bold sm:text-lg">{profile.full_name}</span>
          <Col className="h-full justify-center">
            <span className="line-clamp-3 text-center text-sm font-light leading-tight text-gray-500">
              {profile.bio}
            </span>
          </Col>
        </Col>
      </Link>
    </Card>
  )
}
