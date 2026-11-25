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
  ProfileRail,
  ProjectsSection,
  SECTIONS,
  TransactionsSection,
} from '@/app/[usernameSlug]/sections/sections'
import { RailSkeleton, SectionSkeleton } from '@/app/[usernameSlug]/sections/skeletons'
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
  // Below xl the rail joins the column: first when there's something to do in it (donating to a
  // regrantor, or your own money), otherwise after the sections.
  const railFirst = isOwn || profile.regranter_status

  return (
    <div className="px-4 pb-16 pt-7 font-light">
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

      <div className="flex flex-col gap-7 pt-7 xl:flex-row xl:items-start">
        <main className="order-2 flex min-w-0 flex-1 flex-col gap-16 xl:order-1">
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

        <aside
          className={
            (railFirst ? 'order-1' : 'order-3') +
            ' flex flex-col gap-4 xl:sticky xl:top-16 xl:order-2 xl:w-80 xl:flex-none'
          }
        >
          <Suspense fallback={<RailSkeleton />}>
            <ProfileRail {...sectionProps} />
          </Suspense>
        </aside>
      </div>
    </div>
  )
}
