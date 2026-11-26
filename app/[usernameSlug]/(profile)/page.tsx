import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getProfileByUsername } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { SectionNav } from '@/components/section-nav'
import { fundPath } from '@/utils/funds'
import { ProfileHeader } from '@/app/[usernameSlug]/profile-header'
import { getViewer } from '@/app/[usernameSlug]/profile-data'
import {
  AboutSection,
  CommentsSection,
  DonationsSection,
  DonorLink,
  GivingLine,
  HeaderActions,
  ProfileNav,
  ProjectsSection,
  SECTIONS,
  TransactionsSection,
} from '@/app/[usernameSlug]/sections/sections'
import { SectionSkeleton } from '@/app/[usernameSlug]/sections/skeletons'
import { OldTabLink } from '@/app/[usernameSlug]/sections/old-tab-link'

export async function generateMetadata(props: { params: Promise<{ usernameSlug: string }> }) {
  const { usernameSlug } = await props.params
  const profile = await getProfileByUsername(await createServerSupabaseClient(), usernameSlug)
  if (!profile) return { title: 'Not found' }
  return { title: profile.full_name || profile.username, description: profile.bio || undefined }
}

// A person's profile (E11-E15). Only the profile itself is waited for: the header shows at once, and every
// section streams in on its own as its data arrives (see ./profile-data for what's read and cached).
export default async function UserProfilePage(props: {
  params: Promise<{ usernameSlug: string }>
}) {
  const { usernameSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const [profile, viewer] = await Promise.all([
    getProfileByUsername(supabase, usernameSlug),
    getViewer(),
  ])
  if (!profile) {
    notFound()
  } else if (profile.type === 'fund') {
    // A fund's page is at /funds/<slug> (F1)
    permanentRedirect(fundPath(profile.username))
  } else if (profile.type !== 'individual') {
    return <div>Profile type not supported</div>
  }
  const isOwn = viewer?.id === profile.id
  const sectionProps = { profile, isOwn }

  return (
    // One column, narrow enough to read comfortably; balances live in About.
    <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-7 font-light">
      <OldTabLink />
      <div className="flex gap-1.5 text-[13px] text-gray-500">
        <Link href="/people" className="hover:underline">
          People
        </Link>
        <span>/</span>
        <span className="text-gray-900">{profile.full_name || profile.username}</span>
      </div>

      <div className="mt-5">
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwn}
          email={isOwn ? viewer?.email : undefined}
          actions={
            <Suspense>
              <HeaderActions {...sectionProps} />
            </Suspense>
          }
          links={
            <Suspense>
              <DonorLink {...sectionProps} />
            </Suspense>
          }
          giving={
            <Suspense>
              <GivingLine {...sectionProps} />
            </Suspense>
          }
        />
      </div>

      <Suspense fallback={<SectionNav sections={SECTIONS.map((s) => ({ ...s }))} />}>
        <ProfileNav {...sectionProps} />
      </Suspense>

      <main className="flex flex-col gap-16 pt-8">
        <Suspense fallback={<SectionSkeleton id="about" shape="text" />}>
          <AboutSection {...sectionProps} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton id="projects" title="Projects" shape="cards" />}>
          <ProjectsSection {...sectionProps} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton id="comments" title="Comments" shape="text" />}>
          <CommentsSection {...sectionProps} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton id="donations" title="Donations" shape="rows" />}>
          <DonationsSection {...sectionProps} />
        </Suspense>
        <Suspense
          fallback={<SectionSkeleton id="transactions" title="Transactions" shape="rows" />}
        >
          <TransactionsSection {...sectionProps} />
        </Suspense>
      </main>
    </div>
  )
}
