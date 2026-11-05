import 'server-only'
import type { Metadata } from 'next'
import { createPublicSupabaseClient } from '@/db/supabase-server'
import { getRegranters } from '@/db/profile'
import {
  getSponsoredAmount2023,
  getSponsoredAmount2024,
  getSponsoredAmount2025,
  getSponsoredAmount2026,
} from '@/utils/constants'
import { RegrantingLedger } from './ledger'

export const metadata: Metadata = {
  title: 'Regranting Ledger',
  description: 'Every grant ever made by a Manifund regrantor, tabulated.',
}

// Public, non-personalized data, so prerender to the CDN rather than running a
// slow query per request. force-static is required: the Supabase client's
// no-store fetches and the sidebar's cookies() read would otherwise force
// dynamic rendering. Side effect — the sidebar renders logged-out on a hard
// load of this page (soft nav is unaffected).
export const dynamic = 'force-static'
export const revalidate = 300 // 5 min

// Minimal recursive Tiptap → plaintext (kept local to avoid pulling in Tiptap).
function tiptapToText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) {
    return node.content.map(tiptapToText).join(' ')
  }
  return ''
}

export default async function RegrantingDataPage() {
  const supabase = createPublicSupabaseClient()

  const regrantors = await getRegranters(supabase)
  const regrantorIds = regrantors.map((r) => r.id)

  const { data: grantTxns } = await supabase
    .from('txns')
    .select(
      'id, amount, created_at, from_id, to_id, project, projects(id, title, slug, type, stage, blurb, creator)'
    )
    .in('from_id', regrantorIds)
    .eq('type', 'project donation')
    .eq('token', 'USD')
    .not('project', 'is', null)
    .order('created_at', { ascending: false })
    .throwOnError()

  const validTxns = (grantTxns ?? []).filter(
    (t: any) => t.projects && t.projects.type === 'grant' && t.projects.stage !== 'hidden'
  )

  const projectIds = Array.from(new Set(validTxns.map((t: any) => t.project as string)))

  // Total raised for each project (across all donors, not just regrantors).
  const { data: allFundingTxns } = projectIds.length
    ? await supabase
        .from('txns')
        .select('project, amount')
        .in('project', projectIds)
        .eq('type', 'project donation')
        .eq('token', 'USD')
        .throwOnError()
    : { data: [] }

  const projectTotals: Record<string, number> = {}
  for (const t of allFundingTxns ?? []) {
    if (!t.project) continue
    projectTotals[t.project] = (projectTotals[t.project] ?? 0) + t.amount
  }

  // Regrantor comments on these projects (used as grant explanations).
  const { data: regrantorComments } = projectIds.length
    ? await supabase
        .from('comments')
        .select('id, project, commenter, content, created_at')
        .in('commenter', regrantorIds)
        .in('project', projectIds)
        .is('held_at', null)
        .order('created_at', { ascending: true })
        .throwOnError()
    : { data: [] }

  // For each (regrantor, project), pick the regrantor's earliest substantive comment.
  const commentByKey: Record<string, { text: string; created_at: string }> = {}
  for (const c of regrantorComments ?? []) {
    const key = `${c.commenter}::${c.project}`
    const text = tiptapToText(c.content).trim()
    if (!text || text.length < 40) continue
    if (!commentByKey[key]) {
      commentByKey[key] = { text, created_at: c.created_at }
    }
  }

  const regrantorMap = Object.fromEntries(regrantors.map((r) => [r.id, r]))

  const grants = validTxns.map((t: any) => {
    const r = regrantorMap[t.from_id as string]
    const proj = t.projects
    const key = `${t.from_id}::${t.project}`
    return {
      id: t.id as string,
      date: t.created_at as string,
      amount: t.amount as number,
      regrantorId: t.from_id as string,
      regrantorName: r?.full_name ?? 'Unknown',
      regrantorUsername: r?.username ?? '',
      regrantorAvatar: r?.avatar_url ?? null,
      projectId: t.project as string,
      projectTitle: proj?.title ?? 'Untitled',
      projectSlug: proj?.slug ?? '',
      projectBlurb: proj?.blurb ?? null,
      projectTotal: projectTotals[t.project as string] ?? 0,
      comment: commentByKey[key]?.text ?? null,
    }
  })

  const regrantorRows = regrantors
    .map((r) => ({
      id: r.id,
      name: r.full_name,
      username: r.username,
      avatar: r.avatar_url,
      bio: r.bio,
      budget2023: getSponsoredAmount2023(r.id),
      budget2024: getSponsoredAmount2024(r.id),
      budget2025: getSponsoredAmount2025(r.id),
      budget2026: getSponsoredAmount2026(r.id),
    }))
    .filter((r) => r.budget2023 + r.budget2024 + r.budget2025 + r.budget2026 > 0)

  return <RegrantingLedger grants={grants} regrantors={regrantorRows} />
}
