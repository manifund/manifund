import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { CAPACITIES, GIVING_BANDS_2027, labelFor } from '@/utils/donor-survey'
import type { PublicDonorSurveyResponse } from '@/db/donor-survey'

type HeaderProfile = { username: string; full_name: string; avatar_url: string | null; id: string }

export function DonorPageHeader(props: {
  profile: HeaderProfile | null
  response: Pick<
    PublicDonorSurveyResponse,
    'full_name' | 'capacity' | 'org' | 'giving_2026' | 'updated_at'
  >
}) {
  const { profile, response } = props
  const name = profile?.full_name || response.full_name
  const capacity = (response.capacity ?? [])
    .map((c) => labelFor(CAPACITIES, c))
    .filter(Boolean)
    .join(', ')
  const updated = new Date(response.updated_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return (
    <header className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {profile && (
          <Avatar
            username={profile.username}
            avatarUrl={profile.avatar_url}
            id={profile.id}
            size={16}
          />
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900">
            {name}
          </h1>
          {profile && (
            <Link
              href={`/${profile.username}`}
              className="text-base text-gray-500 hover:text-orange-600"
            >
              @{profile.username}
            </Link>
          )}
          {capacity && (
            <p className="text-base text-gray-700">
              {capacity}
              {response.org ? ` (${response.org})` : ''}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Giving {labelFor(GIVING_BANDS_2027, response.giving_2026) ?? '—'} in 2026. Answers updated{' '}
        {updated}.
      </p>
    </header>
  )
}
