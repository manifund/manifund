// No 'server-only' marker, like lib/notifications/notify.ts: pages/api routes import it. It only works with the
// service-role key, which the browser never has.
// Following people and saved searches (docs/product/follows/README.md, rules F1-F9). Follows and searches are
// written with the signed-in person's own client, so row-level security allows only their own rows (F2), as for
// project follows. Notifying other people uses the admin client. Notifying never throws: the event that caused it
// (a new project, a comment, a donation) already happened; failures are logged (N8).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/db/supabase-admin'
import { escapeHtml } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { notify, ownEmail } from '@/lib/notifications/notify'
import { parseSearch, searchMatches, searchName, searchQuery, type MatchableProject } from './match'

const admin = () => createAdminClient() as any
const base = () => getURL().replace(/\/$/, '')

// F1: following someone covers everything they do. Following again changes nothing.
export async function follow(supabase: SupabaseClient, followerId: string, followedId: string) {
  if (followerId === followedId) return { error: "You can't follow yourself" }
  const { error } = await (supabase as any)
    .from('profile_follows')
    .upsert(
      { follower_id: followerId, followed_id: followedId },
      { onConflict: 'follower_id,followed_id', ignoreDuplicates: true }
    )
  if (error) {
    log.error('follows.follow_failed', { follower_id: followerId, followed_id: followedId, error })
    return { error: 'Could not save' }
  }
  return {}
}

export async function unfollow(supabase: SupabaseClient, followerId: string, followedId: string) {
  const { error } = await (supabase as any)
    .from('profile_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
  if (error)
    log.error('follows.unfollow_failed', {
      follower_id: followerId,
      followed_id: followedId,
      error,
    })
  return error ? { error: 'Could not save' } : {}
}

// F5: a saved search is home's search text and categories (lib/follows/match); its name is generated from them.
// Saving the same search twice keeps one.
export async function saveSearch(supabase: SupabaseClient, ownerId: string, query: string) {
  const db = supabase as any
  const search = parseSearch(query)
  const clean = searchQuery(search)
  if (!clean) return { error: 'Type a search or pick a category first' }
  const { data: existing } = await db
    .from('saved_searches')
    .select('id, name, query')
    .eq('owner_id', ownerId)
    .eq('query', clean)
    .maybeSingle()
  if (existing) return { search: existing }
  const { data: causes } = search.causes.length
    ? await db.from('causes').select('slug, title').in('slug', search.causes)
    : { data: [] }
  const titles = Object.fromEntries(
    ((causes ?? []) as { slug: string; title: string }[]).map((c) => [c.slug, c.title])
  )
  const { data, error } = await db
    .from('saved_searches')
    .insert({ owner_id: ownerId, query: clean, name: searchName(clean, titles) })
    .select('id, name, query')
    .single()
  if (error) {
    log.error('follows.save_search_failed', { owner_id: ownerId, error })
    return { error: 'Could not save' }
  }
  return { search: data }
}

export async function deleteSearch(supabase: SupabaseClient, ownerId: string, id: string) {
  const { error } = await (supabase as any)
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  return error ? { error: 'Could not save' } : {}
}

// Everyone who follows this person (F3, F4).
async function followersOf(followedId: string): Promise<string[]> {
  const { data, error } = await admin()
    .from('profile_follows')
    .select('follower_id')
    .eq('followed_id', followedId)
  if (error) log.error('follows.followers_load_failed', { followed_id: followedId, error })
  return (data ?? []).map((r: { follower_id: string }) => r.follower_id)
}

// F4: recipients for a comment by someone people follow (lib/comments adds them; one notification per person per
// comment, the strongest reason wins, C21).
export async function commentFollowers(commenterId: string) {
  return (await followersOf(commenterId)).map((id) => ({
    id,
    reason: 'followed_person_comment' as const,
  }))
}

async function projectForMatching(projectId: string) {
  const { data: p } = await admin()
    .from('projects')
    .select(
      'id, title, slug, blurb, stage, creator, causes(slug), profiles!projects_creator_fkey(username, full_name)'
    )
    .eq('id', projectId)
    .single()
  if (!p) return null
  const project: MatchableProject & { id: string; slug: string; stage: string; creator: string } = {
    ...p,
    creatorName: p.profiles?.full_name,
    creatorUsername: p.profiles?.username,
  }
  return project
}

// F3 + F6: a project became public (published, or created as a proposal). Followers of its creator hear about it; saved searches it matches notify their owners. Call after the project is saved.
export async function onProjectPublished(projectId: string) {
  try {
    const p = await projectForMatching(projectId)
    if (!p || p.stage === 'draft' || p.stage === 'hidden') return
    const who = p.creatorName || p.creatorUsername || 'Someone you follow'
    const href = `${base()}/projects/${p.slug}`
    for (const followerId of await followersOf(p.creator)) {
      await notify({
        to: followerId,
        reason: 'followed_person_project',
        actorId: p.creator,
        projectId: p.id,
        email: ownEmail(followerId, `Manifund: ${who} posted a new project`, {
          html: `<p>${escapeHtml(who)}, who you follow, posted a new project: <a href="${href}">${escapeHtml(p.title)}</a></p>`,
          text: `${who}, who you follow, posted a new project: ${p.title}\n${href}\n`,
        }),
      })
    }
    await matchSavedSearches(projectId)
  } catch (e) {
    log.error('follows.on_published_failed', { project_id: projectId, error: e })
  }
}

// F6: also when a project's causes change, so a project that gains a cause can match. Each person hears about a
// project once at most (F7).
export async function matchSavedSearches(projectId: string) {
  try {
    const { data: all } = await admin().from('saved_searches').select('id, owner_id, name, query')
    if (!all?.length) return 0
    const p = await projectForMatching(projectId)
    if (!p || p.stage === 'draft' || p.stage === 'hidden') return 0
    const matching = (
      all as { id: string; owner_id: string; name: string; query: string }[]
    ).filter((s) => s.owner_id !== p.creator && searchMatches(s.query, p))
    if (!matching.length) return 0
    // F7: one notification per person per project. Someone already notified about it (for any reason: a person
    // they follow posted it or commented on it, another saved search) hears nothing more. A notification counts
    // whether its email went out right away, waits for the daily summary or isn't sent (the owner's email choice).
    const owners = Array.from(new Set(matching.map((s) => s.owner_id)))
    const [{ data: notified }, { data: aboutComments }] = await Promise.all([
      admin()
        .from('notifications')
        .select('recipient_id')
        .eq('project_id', p.id)
        .in('recipient_id', owners),
      // comment notifications carry the comment, not the project
      admin()
        .from('notifications')
        .select('recipient_id, comment:comments!inner(project)')
        .eq('comment.project', p.id)
        .in('recipient_id', owners),
    ])
    const done = new Set(
      [...(notified ?? []), ...(aboutComments ?? [])].map(
        (r: { recipient_id: string }) => r.recipient_id
      )
    )
    const href = `${base()}/projects/${p.slug}`
    let count = 0
    for (const s of matching) {
      if (done.has(s.owner_id)) continue
      done.add(s.owner_id) // their first matching search announces it
      await notify({
        to: s.owner_id,
        reason: 'saved_search_match',
        projectId: p.id,
        savedSearchId: s.id,
        email: ownEmail(s.owner_id, `Manifund: a new project matches "${s.name}"`, {
          html: `<p>A new project matches your saved search "${escapeHtml(s.name)}": <a href="${href}">${escapeHtml(p.title)}</a></p>`,
          text: `A new project matches your saved search "${s.name}": ${p.title}\n${href}\n`,
        }),
      })
      count++
    }
    return count
  } catch (e) {
    log.error('follows.match_failed', { project_id: projectId, error: e })
    return 0
  }
}

// F4: a donation or an offer by someone people follow. Call after the money moved (or the offer was saved).
export async function onDonation(input: {
  donorId: string
  projectId: string
  amount: number
  txnId?: string | null
  bidId?: string | null
}) {
  try {
    await notifyDonationFollowers(input)
  } catch (e) {
    log.error('follows.on_donation_failed', {
      donor_id: input.donorId,
      project_id: input.projectId,
      error: e,
    })
  }
}

async function notifyDonationFollowers(input: Parameters<typeof onDonation>[0]) {
  const followers = await followersOf(input.donorId)
  if (!followers.length) return
  const { data: p } = await admin()
    .from('projects')
    .select('title, slug, creator')
    .eq('id', input.projectId)
    .single()
  const { data: donor } = await admin()
    .from('profiles')
    .select('username, full_name')
    .eq('id', input.donorId)
    .single()
  if (!p || !donor) return
  const who = donor.full_name || donor.username
  const href = `${base()}/projects/${p.slug}`
  for (const followerId of followers) {
    if (followerId === p.creator) continue // the creator already hears about money to their project
    await notify({
      to: followerId,
      reason: 'followed_person_donation',
      actorId: input.donorId,
      projectId: input.projectId,
      txnId: input.txnId ?? null,
      bidId: input.bidId ?? null,
      amount: input.amount,
      email: ownEmail(followerId, `Manifund: ${who} gave to "${p.title}"`, {
        html: `<p>${escapeHtml(who)}, who you follow, gave to <a href="${href}">${escapeHtml(p.title)}</a>.</p>`,
        text: `${who}, who you follow, gave to ${p.title}\n${href}\n`,
      }),
    })
  }
}
