'use server'
import { createPublicSupabaseClient, createServerSupabaseClient } from '@/db/supabase-server'
import {
  PAGE_SIZE,
  type Page,
  getCommentsPage,
  getLedger,
  getProfileProjects,
  getProjectsByIds,
  getViewer,
} from './profile-data'

// "Show more" on a profile's sections: the next 25 after `offset`. Everything is public; only the owner's own
// drafts depend on who asks, and those come from their own session.

async function viewerIsOwner(profileId: string) {
  const viewer = await getViewer()
  return viewer?.id === profileId
}

async function accreditation(profileId: string) {
  const { data } = await createPublicSupabaseClient()
    .from('profiles')
    .select('accreditation_status')
    .eq('id', profileId)
    .single()
  return !!data?.accreditation_status
}

function slice<T>(rows: T[], offset: number): Page<T> {
  const items = rows.slice(offset, offset + PAGE_SIZE)
  return { items, next: offset + PAGE_SIZE < rows.length ? offset + PAGE_SIZE : null }
}

export async function loadMoreProjects(profileId: string, offset: number) {
  const own = await viewerIsOwner(profileId)
  const { ids } = await getProfileProjects(profileId, own)
  const page = slice(ids, offset)
  const supabase = own ? await createServerSupabaseClient() : createPublicSupabaseClient()
  return { items: await getProjectsByIds(supabase, page.items), next: page.next }
}

export async function loadMoreComments(profileId: string, offset: number) {
  return getCommentsPage(createPublicSupabaseClient(), profileId, offset)
}

export async function loadMoreDonations(profileId: string, offset: number) {
  const own = await viewerIsOwner(profileId)
  const ledger = await getLedger(profileId, await accreditation(profileId), own)
  return slice(ledger.donations, offset)
}

export async function loadMoreTxns(profileId: string, offset: number) {
  const own = await viewerIsOwner(profileId)
  const ledger = await getLedger(profileId, await accreditation(profileId), own)
  return slice(ledger.txns, offset)
}
