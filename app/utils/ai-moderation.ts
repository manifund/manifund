import OpenAI from 'openai'

// Shared by the project spam filter, comment moderation and the account check. Sonnet first; on a
// refusal or error, Haiku; if both fail the caller gets null and fails OPEN, so an API glitch can
// never hide a comment or hold an account.

const PRIMARY_MODEL = 'anthropic/claude-sonnet-5'
const FALLBACK_MODEL = 'anthropic/claude-haiku-4-5'

export function hasModerationKeys() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

async function classifyWithModel<T>(
  systemPrompt: string,
  text: string,
  model: string,
  validate: (parsed: any) => T | null
): Promise<T & { model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')
  const openrouter = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  const completion = await openrouter.chat.completions.create({
    model,
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  // An empty body means the model refused (Anthropic safety classifier): fall back.
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`classifier returned no JSON (model=${model}): "${raw.slice(0, 120)}"`)
  const valid = validate(JSON.parse(match[0]))
  if (!valid) throw new Error(`classifier returned invalid JSON (model=${model}): ${match[0].slice(0, 120)}`)
  return { ...valid, model }
}

export async function classifyJson<T>(
  systemPrompt: string,
  text: string,
  validate: (parsed: any) => T | null
): Promise<(T & { model: string }) | null> {
  try {
    return await classifyWithModel(systemPrompt, text, PRIMARY_MODEL, validate)
  } catch (primaryError) {
    console.warn('Classifier primary failed, falling back to Haiku:', primaryError)
    try {
      return await classifyWithModel(systemPrompt, text, FALLBACK_MODEL, validate)
    } catch (fallbackError) {
      console.error('Classifier fallback also failed; failing open:', fallbackError)
      return null
    }
  }
}

export const COMMENT_CATEGORIES = [
  'scam_phishing',
  'impersonation',
  'spam',
  'harassment',
  'doxxing',
  'offensive',
] as const
export type CommentCategory = (typeof COMMENT_CATEGORIES)[number]

export { CATEGORY_LABELS } from '@/utils/moderation-labels'

export type ModerationVerdict<C extends string = string> = {
  flagged: boolean
  categories: C[]
  reason: string
  model: string
}

function verdictValidator<C extends string>(allowed: readonly C[]) {
  return (parsed: any): Omit<ModerationVerdict<C>, 'model'> | null => {
    if (typeof parsed?.flagged !== 'boolean') return null
    const categories = Array.isArray(parsed.categories)
      ? (parsed.categories as unknown[]).filter((c): c is C => allowed.includes(c as C))
      : []
    // A flag needs a category we know how to show; anything else is treated as not flagged.
    const flagged = parsed.flagged && categories.length > 0
    return {
      flagged,
      categories: flagged ? categories : [],
      reason: String(parsed.reason ?? '').slice(0, 500),
    }
  }
}

const COMMENT_SYSTEM_PROMPT = `You moderate comments on Manifund, a grant-funding platform where people post project proposals and others comment, ask questions, critique, and donate. A flagged comment is hidden behind a click until an admin reviews it, so be conservative: flag only clear cases.

Flag a comment ONLY if it clearly falls into one or more of these categories:
- scam_phishing: tries to get readers to click a link, enter credentials or bank details, send money or crypto, or contact a "support" number; fake account-restriction or verification notices; investment or giveaway scams.
- impersonation: pretends to be Manifund staff, a "Manifund team / support / trust & safety" function, or another real person or organization.
- spam: advertising or promotion unrelated to the project being discussed (product ads, SEO links, drug sales, repeated promotional text).
- harassment: personal attacks, threats, slurs or sustained abuse aimed at a person.
- doxxing: publishes another person's private information (home address, personal phone, private email, ID numbers, financial account details) without their consent.
- offensive: hateful, sexually explicit, or gratuitously graphic content.

Do NOT flag:
- Criticism, even harsh or blunt, of a project, its plan, its budget, its team's track record, or a funder's decision. Skepticism and disagreement are the point of comments here.
- Strong language that isn't aimed at attacking a person.
- Links to the commenter's own work, papers, related projects, or resources relevant to the discussion.
- Someone sharing their OWN contact details, or public professional information about a public figure or organization.
- Low-effort, off-topic, or confused comments that are not ads or scams.

When in doubt, do not flag.

Respond with ONLY a JSON object, no markdown fences:
{"flagged": <true|false>, "categories": [<zero or more of "scam_phishing","impersonation","spam","harassment","doxxing","offensive">], "reason": "<one short sentence>"}`

export async function classifyComment(input: {
  text: string
  authorUsername: string
  authorName: string
  targetTitle: string
}): Promise<ModerationVerdict<CommentCategory> | null> {
  const text = [
    `Commenter: ${input.authorName} (@${input.authorUsername})`,
    `Posted on: ${input.targetTitle}`,
    '',
    'Comment:',
    input.text.slice(0, 3000),
  ].join('\n')
  return classifyJson(COMMENT_SYSTEM_PROMPT, text, verdictValidator(COMMENT_CATEGORIES))
}

export const ACCOUNT_CATEGORIES = ['impersonation', 'offensive'] as const
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]

function accountSystemPrompt(teamNames: string[]) {
  return `You check new account names on Manifund, a grant-funding platform. A flagged account can't post until an admin reviews it, so be conservative: flag only clear cases.

Flag the account ONLY if its username or display name:
- impersonation: poses as Manifund itself or its staff ("Manifund", "Manifund Support", "Manifund Team", "Trust & Safety", "Admin", "Official", "Moderator", and close variants or misspellings), or as one of the Manifund team members listed below, or as a well-known public figure or organization in a way meant to deceive.
- offensive: contains slurs, hate speech, sexual content, or harassment of a person.

Manifund team members: ${teamNames.length ? teamNames.join('; ') : '(none listed)'}

Do NOT flag:
- Ordinary names, even if they share a first name or a common surname with a team member. Only flag a name that matches a team member's full name or is clearly styled to pass as them.
- Names of organizations, labs, or projects the person may genuinely represent.
- Nicknames, handles, email-like usernames, or random strings.

When in doubt, do not flag.

Respond with ONLY a JSON object, no markdown fences:
{"flagged": <true|false>, "categories": [<zero or more of "impersonation","offensive">], "reason": "<one short sentence>"}`
}

export async function classifyAccount(input: {
  username: string
  fullName: string | null
  teamNames: string[]
}): Promise<ModerationVerdict<AccountCategory> | null> {
  const text = `Username: ${input.username}\nDisplay name: ${input.fullName ?? ''}`
  return classifyJson(
    accountSystemPrompt(input.teamNames),
    text,
    verdictValidator(ACCOUNT_CATEGORIES)
  )
}
