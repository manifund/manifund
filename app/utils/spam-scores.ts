import { SupabaseClient } from '@supabase/supabase-js'
import { JSONContent } from '@tiptap/core'
import OpenAI from 'openai'
import { toMarkdown } from '@/utils/tiptap-parsing'
import { getUserEmail, sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { superbanUser } from '@/db/superban'

// Spam gate that runs BEFORE the expensive Pangram + quality scoring. It only
// catches blatant advertising/scam "billboards" (drug sales, phishing, fake
// support numbers) - never low-quality-but-sincere proposals, which the slop
// filter handles. Primary classifier is Sonnet; on a refusal/error it falls
// back to Haiku; if both fail it fails OPEN (treats the project as not spam) so
// an API glitch can never hide or ban a real user.

const PRIMARY_MODEL = 'anthropic/claude-sonnet-5'
const FALLBACK_MODEL = 'anthropic/claude-haiku-4-5'

const MIN_SPAM_CONTENT_CHARS = 15

const SITE_URL = 'https://manifund.org'

// New accounts posting spam are almost always throwaway spammer accounts, so we
// delete them. Older accounts that post spam might be a compromised or confused
// real user, so we only hide the project and let a human follow up.
const SPAM_BAN_MAX_ACCOUNT_AGE_DAYS = 7

export const SPAM_SYSTEM_PROMPT = `You are a spam filter for Manifund, a grant-funding platform where people post proposals asking for money to do a project (research, nonprofits, tools, events, startups, community efforts, etc.). A flagged post gets its author BANNED and deleted, so you must be extremely conservative: only flag content that is unmistakably spam, never a sincere grant request.

The ONE distinction that matters: is this a FUNDING REQUEST, or an ADVERTISING BILLBOARD?

FLAG as spam ONLY if the post is a billboard aimed at readers rather than a request for Manifund funding — it exists to sell something, drive traffic, or run a scam. On this platform that is almost always:
- Drug/pharmaceutical sale ads: "Buy Adderall/Xanax/Oxycodone Online", online pharmacies, "no prescription", coupon codes, order links, overnight delivery.
- Fake customer-service / support-number posts and phishing (e.g. "PayPal Telefonnummer", "Amazon refund hotline", "Binance Kundenservice") — repetitive contact numbers, impersonating a company.
- SEO backlink spam, gift-card/refund scams, or other pure product/traffic advertisements with no ask for a grant.

Do NOT flag (these are NOT spam — set is_spam=false even if low-quality or off-topic):
- Any sincere request for a grant to BUILD, RESEARCH, or DO something — even if it is commercial, a startup, a crypto/token project, off-mission, grandiose, vague, AI-written, eccentric, or unlikely to be funded. That is a real proposal; other filters handle quality.
- A project that describes a product/service it wants to build and gives a budget or funding breakdown. Asking Manifund for money = not spam.
- Research or charity work that merely mentions drugs, medicine, prescriptions, pharmacies, cost, or discounts.
- Empty, blank, test, or placeholder projects (title like "test", "asdf", "delete this", nonsense, or with little or no real content) — these are not advertisements, just empty or unfinished. Never flag them.

If the post asks Manifund for funding to do something, is_spam is FALSE — no matter how bad or commercial it is. Only flag pure advertisements/scams that are not funding requests at all. When in doubt, is_spam=false.

Respond with ONLY a JSON object, no markdown fences:
{"is_spam": <true only for advertising/scam billboards that are not a genuine grant request>, "confidence": <0-1>, "reason": "<one short sentence>"}`

export type SpamVerdict = {
  is_spam: boolean
  confidence: number
  reason: string
  model: string
}

export function hasSpamScoringKeys() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

function spamText(project: {
  title: string
  blurb: string | null
  description: JSONContent | null
}) {
  const parts = [project.title]
  if (project.blurb) parts.push(project.blurb)
  if (project.description) {
    const body = toMarkdown(project.description)
    if (body.trim()) parts.push(body)
  }
  // Spam is unmistakable from the top of the post; a tight cap keeps this cheap.
  return parts.join('\n\n').slice(0, 2000)
}

async function classifyWithModel(text: string, model: string): Promise<SpamVerdict> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')
  const openrouter = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })

  const completion = await openrouter.chat.completions.create({
    model,
    max_tokens: 500,
    messages: [
      { role: 'system', content: SPAM_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  // An empty body means the model refused (Anthropic safety classifier) - treat
  // as a failure so the caller falls back to the other model.
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match)
    throw new Error(`spam classifier returned no JSON (model=${model}): "${raw.slice(0, 120)}"`)
  const parsed = JSON.parse(match[0]) as Omit<SpamVerdict, 'model'>
  if (typeof parsed.is_spam !== 'boolean') {
    throw new Error(
      `spam classifier returned invalid is_spam (model=${model}): ${match[0].slice(0, 120)}`
    )
  }
  return { ...parsed, model }
}

// Sonnet primary -> Haiku on refusal/error -> fail open (not spam).
export async function classifyProjectSpam(project: {
  title: string
  blurb: string | null
  description: JSONContent | null
}): Promise<SpamVerdict> {
  const text = spamText(project)
  if (text.replace(/\s+/g, '').length < MIN_SPAM_CONTENT_CHARS) {
    return {
      is_spam: false,
      confidence: 1,
      reason: 'too little content to be spam',
      model: 'guard',
    }
  }
  try {
    return await classifyWithModel(text, PRIMARY_MODEL)
  } catch (primaryError) {
    console.warn('Spam classifier primary failed, falling back to Haiku:', primaryError)
    try {
      return await classifyWithModel(text, FALLBACK_MODEL)
    } catch (fallbackError) {
      console.error('Spam classifier fallback also failed; failing open:', fallbackError)
      return { is_spam: false, confidence: 0, reason: 'classifier unavailable', model: 'none' }
    }
  }
}

async function accountAgeDays(
  adminSupabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data, error } = await adminSupabase.auth.admin.getUserById(userId)
  if (error || !data?.user?.created_at) {
    console.error('Could not read account age for spam handling:', error)
    return null
  }
  const ageMs = Date.now() - new Date(data.user.created_at).getTime()
  return ageMs / (1000 * 60 * 60 * 24)
}

async function emailSpamNotice(
  adminSupabase: SupabaseClient,
  project: {
    id: string
    title: string
    slug: string
    creator: string
    description: JSONContent | null
    blurb: string | null
  },
  action: 'hidden' | 'removed'
) {
  const email = await getUserEmail(adminSupabase, project.creator)
  if (!email) return
  const proposalText = [
    project.title,
    project.blurb ?? '',
    project.description ? toMarkdown(project.description) : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000)
  const actionText =
    action === 'removed'
      ? 'automatically flagged as spam, and your account has been removed'
      : 'automatically flagged as spam and hidden from the site'
  await sendTemplateEmail(
    TEMPLATE_IDS.GENERIC_NOTIF,
    {
      notifText: `Your Manifund project "${project.title}" was ${actionText}. If you believe this was a mistake, reply to this email and we'll take a look.\n\nFor your reference, here is what you submitted:\n\n${proposalText}`,
      buttonUrl: SITE_URL,
      buttonText: 'Go to Manifund',
      subject: 'Your Manifund project was flagged by our spam filter',
    },
    undefined,
    email
  )
}

// Records a spam verdict to project_scores for the admin audit trail / shadow
// mode. (For banned users this row is cascade-deleted with the project; for
// hidden projects it persists so an admin can see why it was hidden.)
export async function recordSpamVerdict(
  adminSupabase: SupabaseClient,
  projectId: string,
  verdict: SpamVerdict
) {
  await adminSupabase.from('project_scores').upsert(
    {
      project_id: projectId,
      is_spam: verdict.is_spam,
      spam_reason: `[${verdict.model}] ${verdict.reason}`,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'project_id', ignoreDuplicates: false }
  )
}

// Acts on a spam verdict: emails the creator (before any deletion), then bans
// new accounts or hides the project for established ones. Never throws - spam
// handling must not break the create/score flow.
//
// Idempotency: a project that is already stage='hidden' has already been
// disposed of by a prior run. Re-running this pipeline (e.g. because the owner
// edited a hidden project and /api/score-project re-entered the gate) would
// re-send the spam-notice email and re-evaluate the ban decision, which can
// escalate a hide to a full account ban. The route-level stage filter
// prevents re-entry; this guard protects any future caller. Pass force: true
// to override (e.g. an admin re-triggering on a reclassified project).
export async function handleSpamProject(
  adminSupabase: SupabaseClient,
  project: {
    id: string
    title: string
    slug: string
    creator: string
    description: JSONContent | null
    blurb: string | null
    stage?: string | null
  },
  verdict: SpamVerdict,
  options?: { force?: boolean }
) {
  if (project.stage === 'hidden' && !options?.force) return
  try {
    await recordSpamVerdict(adminSupabase, project.id, verdict)

    const ageDays = await accountAgeDays(adminSupabase, project.creator)
    // If we can't determine age, don't ban - only hide (the safer action).
    const shouldBan = ageDays !== null && ageDays < SPAM_BAN_MAX_ACCOUNT_AGE_DAYS

    // Email first: banning deletes the account, so we resolve the address and
    // send while it still exists.
    await emailSpamNotice(adminSupabase, project, shouldBan ? 'removed' : 'hidden')

    if (shouldBan) {
      await superbanUser(adminSupabase, project.creator)
    } else {
      await adminSupabase.from('projects').update({ stage: 'hidden' }).eq('id', project.id)
    }
  } catch (error) {
    console.error('handleSpamProject failed:', error)
  }
}
