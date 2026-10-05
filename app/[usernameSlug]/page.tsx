import { getProfileById, getProfileByUsername, getUser, isAdmin } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { ProfileHeader } from './profile-header'
import { getFullTxnsByUser, getTxnsByUser } from '@/db/txn'
import { getProjectsByUser } from '@/db/project'
import { ProfileContent } from './profile-content'
import { getBidsByUser } from '@/db/bid'
import { getCommentsByTarget, getCommentsByUser } from '@/db/comment'
import FundPage from '../funds/[fundSlug]/page'
import { notFound } from 'next/navigation'
import { getResponseByProfileId } from '@/db/donor-survey'

export const revalidate = 60

export default async function UserProfilePage(props: {
  params: Promise<{ usernameSlug: string }>
}) {
  const { usernameSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const profile = await getProfileByUsername(supabase, usernameSlug)
  if (!profile) {
    notFound()
  } else if (profile.type === 'fund') {
    return <FundPage params={Promise.resolve({ fundSlug: usernameSlug })} />
  } else if (profile.type !== 'individual') {
    return <div>Profile type not supported</div>
  }
  const [bids, projects, txns, comments, profileComments, user, donorResponse] = await Promise.all([
    getBidsByUser(supabase, profile.id),
    getProjectsByUser(supabase, profile.id),
    getFullTxnsByUser(supabase, profile.id),
    getCommentsByUser(supabase, profile.id),
    getCommentsByTarget(supabase, { profile_id: profile.id }),
    getUser(supabase),
    getResponseByProfileId(profile.id),
  ])
  const [userTxns, userProfile, userBids] = await Promise.all([
    user ? getTxnsByUser(supabase, user.id) : undefined,
    user ? getProfileById(supabase, user.id) : undefined,
    user ? getBidsByUser(supabase, user.id) : undefined,
  ])
  const isOwnProfile = user?.id === profile?.id
  const userIsAdmin = isAdmin(user)
  // Link the donor survey answers when they're public, and for the donor
  // themself so they can find the page.
  const showDonorPage = !!donorResponse && (donorResponse.is_public || isOwnProfile)
  return (
    <div className="flex flex-col gap-8 p-3 sm:p-5">
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        email={isOwnProfile ? user.email : undefined}
        isAdmin={userIsAdmin}
        projects={projects}
        comments={comments}
        donorPage={showDonorPage}
      />
      <ProfileContent
        profile={profile}
        projects={projects}
        comments={comments}
        profileComments={profileComments}
        bids={bids}
        txns={txns}
        userProfile={userProfile}
        userTxns={userTxns}
        userBids={userBids}
      />
    </div>
  )
}
