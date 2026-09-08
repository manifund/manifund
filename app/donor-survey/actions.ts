'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { createAdminClient } from '@/db/supabase-admin'
import { getProfileById, getUser } from '@/db/profile'
import {
  DonorSurveyInsert,
  getResponseByEmail,
  getResponseByProfileId,
  getResponseByToken,
} from '@/db/donor-survey'
import { generateSigningToken, hashSigningToken } from '@/utils/signing-token'
import { escapeHtml, sendEmail } from '@/utils/email'
import { getURL } from '@/utils/constants'
import {
  CAPACITIES,
  FREQUENCIES,
  FUNDS_VS_DIRECT_STOPS,
  GIVING_BANDS,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  parseCauseAllocation,
  EDIT_COOKIE,
  type CauseAllocation,
} from '@/utils/donor-survey'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export type DonorSurveyInput = {
  full_name: string
  email: string
  capacity: string[]
  org: string
  giving_2026: string
  giving_2027: string
  cause_allocation: CauseAllocation
  advice_sources: string
  landscape_problems: string
  funds_vs_direct: number | null
  already_given: string
  evaluation_approach: string
  charities_interested: string
  hours_per_month: string
  dream_setup: string
  wants_opportunities: boolean | null
  opportunity_frequency: string
  wants_call: boolean
  wants_events: boolean
  share_with_funders: boolean
  is_public: boolean
  other_thoughts: string
  referrals: string
}

export type SaveResult =
  | { type: 'saved' }
  | { type: 'existing'; email: string }
  | { type: 'error'; text: string; field?: keyof DonorSurveyInput }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_TEXT = 10_000

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : ''
}
function orNull(value: string) {
  return value === '' ? null : value
}
function keyIn(options: readonly { key: string }[], value: unknown) {
  return typeof value === 'string' && options.some((o) => o.key === value) ? value : null
}

function validate(raw: DonorSurveyInput): { ok: true; row: DonorSurveyInsert } | SaveResult {
  const full_name = text(raw.full_name).slice(0, 200)
  const email = text(raw.email).toLowerCase().slice(0, 320)
  if (!full_name) return { type: 'error', text: 'Enter your name.', field: 'full_name' }
  if (!EMAIL_RE.test(email)) return { type: 'error', text: 'Enter a valid email.', field: 'email' }

  const capacity = Array.isArray(raw.capacity)
    ? raw.capacity.filter((c): c is string => CAPACITIES.some((o) => o.key === c))
    : []
  if (capacity.length === 0)
    return { type: 'error', text: 'Pick at least one option.', field: 'capacity' }

  const giving_2026 = keyIn(GIVING_BANDS, raw.giving_2026)
  if (!giving_2026) return { type: 'error', text: 'Pick a range.', field: 'giving_2026' }
  const giving_2027 = keyIn(GIVING_BANDS_2027, raw.giving_2027)
  if (!giving_2027) return { type: 'error', text: 'Pick a range.', field: 'giving_2027' }

  const cause_allocation = parseCauseAllocation(raw.cause_allocation).filter(
    (c) => c.name.trim() !== ''
  )
  const total = cause_allocation.reduce((a, c) => a + c.pct, 0)
  if (cause_allocation.length === 0 || total !== 100)
    return { type: 'error', text: 'Proportions need to add up to 100%.', field: 'cause_allocation' }

  const funds_vs_direct =
    typeof raw.funds_vs_direct === 'number' &&
    (FUNDS_VS_DIRECT_STOPS as readonly number[]).includes(raw.funds_vs_direct)
      ? raw.funds_vs_direct
      : null

  const wants_opportunities =
    typeof raw.wants_opportunities === 'boolean' ? raw.wants_opportunities : null
  if (wants_opportunities === null)
    return { type: 'error', text: 'Pick yes or no.', field: 'wants_opportunities' }
  const opportunity_frequency = wants_opportunities
    ? keyIn(FREQUENCIES, raw.opportunity_frequency)
    : null
  if (wants_opportunities && !opportunity_frequency)
    return { type: 'error', text: 'Pick how often.', field: 'opportunity_frequency' }

  return {
    ok: true,
    row: {
      full_name,
      email,
      capacity,
      org: capacity.some((c) => c !== 'own_money') ? orNull(text(raw.org).slice(0, 300)) : null,
      giving_2026,
      giving_2027,
      cause_allocation,
      advice_sources: orNull(text(raw.advice_sources)),
      landscape_problems: orNull(text(raw.landscape_problems)),
      funds_vs_direct,
      already_given: orNull(text(raw.already_given)),
      evaluation_approach: orNull(text(raw.evaluation_approach)),
      charities_interested: orNull(text(raw.charities_interested)),
      hours_per_month: keyIn(HOURS_BANDS, raw.hours_per_month),
      dream_setup: orNull(text(raw.dream_setup)),
      wants_opportunities,
      opportunity_frequency,
      wants_call: raw.wants_call === true,
      wants_events: raw.wants_events === true,
      share_with_funders: raw.share_with_funders === true,
      is_public: raw.is_public === true,
      other_thoughts: orNull(text(raw.other_thoughts)),
      referrals: orNull(text(raw.referrals)),
      updated_at: new Date().toISOString(),
    },
  }
}

async function setEditCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(EDIT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/donor-survey',
    maxAge: COOKIE_MAX_AGE,
  })
}

async function sendEditLink(email: string, fullName: string, token: string) {
  const link = `${getURL()}donor-survey?token=${token}`
  const html = `<p>Hi ${escapeHtml(fullName)},</p>
<p>Thanks for filling out the Manifund donor survey. You can come back and change your answers any time with this link:</p>
<p><a href="${link}">${link}</a></p>
<p>The same link also gets you to what other donors answered: <a href="${getURL()}donor-survey/results">${getURL()}donor-survey/results</a></p>
<p>Austin</p>`
  const plain = `Hi ${fullName},\n\nThanks for filling out the Manifund donor survey. You can come back and change your answers any time with this link:\n\n${link}\n\nThe same link also gets you to what other donors answered: ${getURL()}donor-survey/results\n\nAustin`
  await sendEmail(email, 'Your Manifund donor survey answers', html, plain)
}

async function findProfileIdByEmail(email: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()
  return data?.id ?? null
}

function revalidate(username?: string | null) {
  revalidatePath('/donor-survey')
  revalidatePath('/donor-survey/results')
  if (username) revalidatePath(`/${username}/donor`)
}

export async function saveDonorSurvey(
  raw: DonorSurveyInput,
  tokenFromUrl?: string | null
): Promise<SaveResult> {
  const validated = validate(raw)
  if (!('ok' in validated)) return validated
  const row = validated.row

  const supabase = await createServerSupabaseClient()
  const admin = createAdminClient()
  const user = await getUser(supabase)

  if (user) {
    // Signed in: the account's email wins over whatever was typed, and an
    // earlier email-only response under that address becomes this account's.
    const email = user.email?.toLowerCase() ?? row.email
    const existing = (await getResponseByProfileId(user.id)) ?? (await getResponseByEmail(email))
    const profile = await getProfileById(supabase, user.id)
    const values = { ...row, email, profile_id: user.id }
    if (existing) {
      await admin.from('donor_survey_responses').update(values).eq('id', existing.id).throwOnError()
    } else {
      await admin.from('donor_survey_responses').insert(values).throwOnError()
    }
    revalidate(profile?.username)
    return { type: 'saved' }
  }

  // Not signed in. A valid edit token (from the emailed link, or the cookie set
  // on a previous save) lets the respondent update their own row.
  const cookieStore = await cookies()
  const token = tokenFromUrl || cookieStore.get(EDIT_COOKIE)?.value
  const byToken = await getResponseByToken(token)
  if (byToken && token) {
    const clash = await getResponseByEmail(row.email)
    if (clash && clash.id !== byToken.id) {
      return { type: 'error', text: 'Another response already uses this email.', field: 'email' }
    }
    await admin.from('donor_survey_responses').update(row).eq('id', byToken.id).throwOnError()
    await setEditCookie(token)
    revalidate()
    return { type: 'saved' }
  }

  // No token. If this email already has answers, never overwrite them from an
  // unauthenticated request: mail a fresh edit link to the address instead.
  const profileId = await findProfileIdByEmail(row.email)
  const existing =
    (await getResponseByEmail(row.email)) ??
    (profileId ? await getResponseByProfileId(profileId) : null)
  if (existing) {
    const fresh = generateSigningToken()
    await admin
      .from('donor_survey_responses')
      .update({ edit_token_hash: await hashSigningToken(fresh) })
      .eq('id', existing.id)
      .throwOnError()
    await sendEditLink(existing.email, existing.full_name, fresh)
    return { type: 'existing', email: existing.email }
  }

  const fresh = generateSigningToken()
  await admin
    .from('donor_survey_responses')
    .insert({ ...row, profile_id: profileId, edit_token_hash: await hashSigningToken(fresh) })
    .throwOnError()
  await setEditCookie(fresh)
  await sendEditLink(row.email, row.full_name, fresh)
  revalidate()
  return { type: 'saved' }
}
