// The donor survey's pages and its save action, as visitors, the file's own people and the admin
// (docs/ai-reference/donor-survey/README.md). Only this file's people and responses (emails starting with the run marker),
// deleted at the end. Real answers are personal data: the admin's pages list them, so checks on those pages only
// look for this file's own strings and never print the page (`has`, not `toContain`, so a failure shows no HTML).
//
// Saving is a Next.js server action (`saveDonorSurvey`), not an API route. The tests call it as the form does: a POST
// to /donor-survey with the action's id (found in the page's scripts, as the browser finds it) and its arguments.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { anonymous, cookieForEmail, type Client } from '../helpers/http'
import { as, person } from '../helpers/people'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'
import { EMPTY_SURVEY, type DonorSurveyInput } from '@/utils/donor-survey'

type SaveResult =
  | { type: 'saved' }
  | { type: 'existing'; email: string }
  | { type: 'error'; text: string }

const EDIT_COOKIE = 'donor_survey_edit'
const email = (name: string) => `${RUN}-${name}@example.test`
const answers = (fields: Partial<DonorSurveyInput> = {}): DonorSurveyInput => ({
  ...EMPTY_SURVEY,
  full_name: 'Test Donor',
  // The form also sends the account's name and email when signed in (the server replaces them, D7)
  email: email('typed'),
  capacity: ['own_money'],
  giving_2026: 'under_50k',
  giving_2027: 'not_sure',
  ...fields,
})
// React separates adjacent text with <!-- --> in server HTML.
const has = (text: string, part: string) => text.replaceAll('<!-- -->', '').includes(part)
// The rendered not-found page (every page's payload also carries its text, JSON-escaped, for the not-found boundary).
const NOT_FOUND = 'Page not found</h1>'

// The action's id, from the survey page's scripts (dev builds name the function there).
let actionId: string | undefined
async function findActionId() {
  const html = await (await fetch(`${env.baseUrl}/donor-survey`)).text()
  const scripts = [
    ...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1])),
  ]
  for (const src of scripts) {
    const js = await (await fetch(`${env.baseUrl}${src}`)).text()
    // Turbopack: createServerReference"])("<id>", …, "saveDonorSurvey"); webpack: the same inside an eval'd string.
    const m = js.match(
      /createServerReference[^(]*\(\\?"([0-9a-f]+)\\?",[^;]*?\\?"saveDonorSurvey\\?"\)/
    )
    if (m) return m[1]
  }
  throw new Error(
    'saveDonorSurvey not found in /donor-survey scripts (these tests expect a dev server)'
  )
}

// Calls the save action. `cookie` is the whole Cookie header (a session and/or the edit cookie).
async function save(raw: DonorSurveyInput, opts: { cookie?: string; token?: string } = {}) {
  actionId ??= await findActionId()
  const res = await fetch(`${env.baseUrl}/donor-survey`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'next-action': actionId,
      'content-type': 'text/plain;charset=UTF-8',
      accept: 'text/x-component',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: JSON.stringify([raw, opts.token ?? null]),
  })
  const text = await res.text()
  const line = text.split('\n').find((l) => /^\w+:\{"type":/.test(l))
  if (!line) throw new Error(`no result from the save action (${res.status})`)
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith(`${EDIT_COOKIE}=`))
  return {
    result: JSON.parse(line.slice(line.indexOf(':') + 1)) as SaveResult,
    setCookie,
    token: setCookie?.match(new RegExp(`^${EDIT_COOKIE}=([^;]*)`))?.[1],
  }
}
const editCookie = (token: string) => `${EDIT_COOKIE}=${token}`
const sessionOf = (c: Client) => cookieForEmail(`${c.username}@local.test`)
async function page(path: string, cookie?: string) {
  const res = await fetch(`${env.baseUrl}${path}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  })
  return { status: res.status, text: await res.text(), setCookie: res.headers.getSetCookie() }
}
async function rowByEmail(e: string) {
  const rows = await sql`select * from donor_survey_responses where email = ${e}`
  return rows[0] as Record<string, any> | undefined
}
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

let rita: Client
beforeAll(async () => {
  rita = await as('rita')
})
afterAll(async () => {
  await sql`delete from donor_survey_responses where email like ${RUN + '%'}`
})

describe('D1 anyone can take the survey, signed in or not', () => {
  smoke('signed out: sign in (back to the survey), or a name and an email', async () => {
    const r = await anonymous().get('/donor-survey')
    expect(r.status).toBe(200)
    for (const part of [
      'Donor survey',
      'Sign in with Manifund',
      'href="/login?next=/donor-survey"',
      'Full name',
      'Email',
    ])
      expect(has(r.text, part)).toBe(true)
  })
  standard('signed in: the account, no name or email to type', async () => {
    const ann = await person('d1')
    const r = await page('/donor-survey', await sessionOf(ann))
    expect(has(r.text, 'Signed in as Test d1')).toBe(true)
    expect(has(r.text, 'Sign in with Manifund')).toBe(false)
  })
})

describe('D2 required answers', () => {
  const refused: [string, Partial<DonorSurveyInput>, string][] = [
    ['no name', { full_name: '  ' }, 'Enter your name.'],
    ['no valid email', { email: 'not-an-email' }, 'Enter a valid email.'],
    ['no capacity', { capacity: [] }, 'Pick at least one option.'],
    ['an unknown capacity only', { capacity: ['billionaire'] }, 'Pick at least one option.'],
    ['no 2026 amount', { giving_2026: '' }, 'Pick a range.'],
    ['"not sure" for 2026', { giving_2026: 'not_sure' }, 'Pick a range.'],
    ['no 2027 amount', { giving_2027: '' }, 'Pick a range.'],
  ]
  for (const [what, fields, message] of refused)
    standard(`refused: ${what}`, async () => {
      const e = email(`d2-${what.replace(/\W+/g, '-')}`)
      const { result } = await save(answers({ email: e, ...fields }))
      expect(result).toEqual({ type: 'error', text: message })
      expect(await rowByEmail(e)).toBeUndefined()
    })
  smoke('everything else is optional', async () => {
    const e = email('d2-minimal')
    expect((await save(answers({ email: e }))).result).toEqual({ type: 'saved' })
    expect(await rowByEmail(e)).toBeDefined()
  })
})

describe('D3 D4 the server keeps only answers it knows', () => {
  smoke(
    'unknown options dropped, text trimmed and capped, email lowercased, ratings checked',
    async () => {
      const e = email('d3')
      const { result } = await save(
        answers({
          email: `  ${e.toUpperCase()} `,
          capacity: ['own_money', 'bogus'],
          org: 'Ignored Org',
          hours_per_month: 'lots',
          wants_opportunities: false,
          opportunity_frequency: 'weekly',
          funds_vs_direct: 37,
          advice_sources: '  some advice  ',
          landscape_problems: '',
          dream_setup: 'x'.repeat(20_000),
          wants_call: 'yes' as any,
          cause_ratings: [
            { name: 'AI safety', rating: 5 },
            { name: 'ai safety', rating: 1 },
            { name: 'Shrimp', rating: 9 },
          ],
        })
      )
      expect(result).toEqual({ type: 'saved' })
      const row = (await rowByEmail(e))!
      expect(row.capacity).toEqual(['own_money'])
      expect(row.org).toBeNull() // own money only
      expect(row.hours_per_month).toBeNull()
      expect(row.opportunity_frequency).toBeNull() // doesn't want opportunities
      expect(row.funds_vs_direct).toBeNull()
      expect(row.advice_sources).toBe('some advice')
      expect(row.landscape_problems).toBeNull()
      expect(row.dream_setup).toHaveLength(10_000)
      expect(row.wants_call).toBe(false)
      expect(row.cause_ratings).toEqual([{ name: 'AI safety', rating: 5 }])
    }
  )
  standard(
    'kept: an org with another capacity, a frequency with opportunities, funds in steps of 5',
    async () => {
      const e = email('d3-kept')
      await save(
        answers({
          email: e,
          capacity: ['regrantor'],
          org: 'Example Fund',
          wants_opportunities: true,
          opportunity_frequency: 'quarterly',
          funds_vs_direct: 35,
          hours_per_month: '3_10',
        })
      )
      const row = (await rowByEmail(e))!
      expect([
        row.org,
        row.opportunity_frequency,
        row.funds_vs_direct,
        row.hours_per_month,
      ]).toEqual(['Example Fund', 'quarterly', 35, '3_10'])
    }
  )
})

describe('D9 a first signed-out save: a new response, an edit link and a cookie', () => {
  smoke(
    'the cookie holds the token, only for /donor-survey, for a year; only its hash is stored',
    async () => {
      const e = email('d9')
      const { result, setCookie, token } = await save(answers({ email: e }))
      expect(result).toEqual({ type: 'saved' })
      expect(token).toBeTruthy()
      expect(setCookie).toMatch(/Path=\/donor-survey(;|$)/)
      expect(setCookie).toMatch(/Max-Age=31536000/)
      expect(setCookie).toMatch(/HttpOnly/i)
      const row = (await rowByEmail(e))!
      expect(row.edit_token_hash).toBe(sha256(decodeURIComponent(token!)))
      expect(row.profile_id).toBeNull()
    }
  )
  standard('linked to the account that has the email (privately: D8)', async () => {
    const owner = await person('d9-owner')
    const e = `${owner.username}@local.test`
    await save(answers({ email: e, is_public: true }))
    const row = (await rowByEmail(e))!
    expect(row.profile_id).toBe(owner.id)
    expect(row.is_public).toBe(false)
  })
})

describe('D8 a signed-out save is never public', () => {
  smoke('"public" is saved as no', async () => {
    const e = email('d8')
    await save(answers({ email: e, is_public: true }))
    expect((await rowByEmail(e))!.is_public).toBe(false)
  })
  // The form's hint that public pages need an account shows once the box is ticked: client-side, not checked here.
})

describe('D10 the edit link or the cookie changes the response', () => {
  smoke('with the cookie: answers and email change, the same response', async () => {
    const e = email('d10')
    const { token } = await save(answers({ email: e }))
    const [{ id }] = await sql`select id from donor_survey_responses where email = ${e}`
    const e2 = email('d10-new')
    const again = await save(answers({ email: e2, advice_sources: 'changed' }), {
      cookie: editCookie(token!),
    })
    expect(again.result).toEqual({ type: 'saved' })
    const row = (await rowByEmail(e2))!
    expect([row.id, row.advice_sources]).toEqual([id, 'changed'])
    expect(await rowByEmail(e)).toBeUndefined()
  })
  standard('with the link (no cookie) too; the link wins over another cookie', async () => {
    const a = email('d10-a')
    const b = email('d10-b')
    const { token: ta } = await save(answers({ email: a }))
    const { token: tb } = await save(answers({ email: b }))
    const r = await save(answers({ email: a, advice_sources: 'via link' }), {
      token: ta!,
      cookie: editCookie(tb!),
    })
    expect(r.result).toEqual({ type: 'saved' })
    expect((await rowByEmail(a))!.advice_sources).toBe('via link')
    expect((await rowByEmail(b))!.advice_sources).toBeNull()
  })
  standard("another response's email is refused", async () => {
    const a = email('d10-c')
    const b = email('d10-d')
    const { token } = await save(answers({ email: a }))
    await save(answers({ email: b }))
    const r = await save(answers({ email: b }), { cookie: editCookie(token!) })
    expect(r.result).toEqual({ type: 'error', text: 'Another response already uses this email.' })
  })
})

describe('D11 a signed-out save under an email that has answers changes no answers', () => {
  smoke('it makes a new edit link instead; the earlier one stops working', async () => {
    const e = email('d11')
    const { token } = await save(answers({ email: e, advice_sources: 'original' }))
    const before = (await rowByEmail(e))!
    const r = await save(answers({ email: e.toUpperCase(), advice_sources: 'overwritten?' }))
    expect(r.result).toEqual({ type: 'existing', email: e })
    expect(r.setCookie).toBeUndefined()
    const after = (await rowByEmail(e))!
    expect(after.advice_sources).toBe('original')
    expect(after.edit_token_hash).not.toBe(before.edit_token_hash)
    // The old cookie no longer opens the response
    const old = await save(answers({ email: e, advice_sources: 'old link' }), {
      cookie: editCookie(token!),
    })
    expect(old.result.type).toBe('existing')
  })
  standard('also under an email whose account has answers under another email', async () => {
    const owner = await person('d11-owner')
    // The account's response under another address (as after an email change): made directly, this file's own row.
    const other = email('d11-other')
    await sql`insert into donor_survey_responses (profile_id, full_name, email, advice_sources)
              values (${owner.id}, 'Test d11-owner', ${other}, 'original')`
    const r = await save(
      answers({ email: `${owner.username}@local.test`, advice_sources: 'overwritten?' })
    )
    expect(r.result).toEqual({ type: 'existing', email: `${owner.username}@local.test` })
    expect((await rowByEmail(other))!.advice_sources).toBe('original')
    expect((await rowByEmail(other))!.edit_token_hash).not.toBeNull()
  })
})

describe('D7 a signed-in save is the account’s', () => {
  smoke("the account's email and profile name replace the typed ones", async () => {
    const ann = await person('d7')
    const r = await save(answers({ email: email('d7-typed'), full_name: 'Typed Name' }), {
      cookie: await sessionOf(ann),
    })
    expect(r.result).toEqual({ type: 'saved' })
    expect(r.setCookie).toBeUndefined()
    expect(await rowByEmail(email('d7-typed'))).toBeUndefined()
    const row = (await rowByEmail(`${ann.username}@local.test`))!
    expect([row.profile_id, row.full_name]).toEqual([ann.id, 'Test d7'])
  })
  standard(
    'saving again changes the same response (D5); an earlier signed-out one under the email is taken over',
    async () => {
      const ben = await person('d7-ben')
      const e = `${ben.username}@local.test`
      await save(answers({ email: e }))
      const [{ id }] = await sql`select id from donor_survey_responses where email = ${e}`
      const cookie = await sessionOf(ben)
      await save(answers({ advice_sources: 'first' }), { cookie })
      await save(answers({ advice_sources: 'second' }), { cookie })
      const rows =
        await sql`select id, profile_id, advice_sources from donor_survey_responses where profile_id = ${ben.id} or email = ${e}`
      expect(rows).toEqual([{ id, profile_id: ben.id, advice_sources: 'second' }])
    }
  )
})

describe('D6 the survey shows the saved answers to edit', () => {
  smoke('signed out: through the edit link, or the cookie', async () => {
    const e = email('d6')
    const { token } = await save(answers({ email: e, advice_sources: `D6-${RUN}` }))
    expect(has((await page(`/donor-survey?token=${token}`)).text, `D6-${RUN}`)).toBe(true)
    expect(has((await page('/donor-survey', editCookie(token!))).text, `D6-${RUN}`)).toBe(true)
    expect(has((await page('/donor-survey')).text, `D6-${RUN}`)).toBe(false)
  })
  standard("signed in: the account's response", async () => {
    const ann = await person('d6-signed')
    const cookie = await sessionOf(ann)
    await save(answers({ advice_sources: `D6s-${RUN}` }), { cookie })
    expect(has((await page('/donor-survey', cookie)).text, `D6s-${RUN}`)).toBe(true)
  })
  // After a save the form moves to /donor-survey/results: client-side (router.push), checked by hand only.
})

const GATE = 'Sorry, the results are only visible to people who have filled out the survey.'
describe('D12 the results are for admins and respondents', () => {
  smoke('visitors and people who haven’t answered see the gate', async () => {
    const r = await anonymous().get('/donor-survey/results')
    expect(r.status).toBe(200)
    expect(has(r.text, GATE)).toBe(true)
    const nobody = await person('d12-nobody')
    expect(has((await page('/donor-survey/results', await sessionOf(nobody))).text, GATE)).toBe(
      true
    )
  })
  smoke('a signed-out respondent, with the cookie', async () => {
    const { token } = await save(answers({ email: email('d12') }))
    const r = await page('/donor-survey/results', editCookie(token!))
    expect(has(r.text, GATE)).toBe(false)
    expect(has(r.text, 'what other donors said')).toBe(true)
  })
  standard('a signed-in respondent, and an admin', async () => {
    const ann = await person('d12-signed')
    const cookie = await sessionOf(ann)
    await save(answers(), { cookie })
    expect(has((await page('/donor-survey/results', cookie)).text, GATE)).toBe(false)
    expect(has((await rita.get('/donor-survey/results')).text, GATE)).toBe(false)
  })
  // Open question (README, "The emailed results link doesn't open the results on a new device"): opening the edit
  // link sets no cookie, so a respondent on another browser can't reach the results without saving again.
  test.skip('the edit link opens the results on a new browser too', async () => {
    const { token } = await save(answers({ email: email('d12-newdevice') }))
    const opened = await page(`/donor-survey?token=${token}`)
    const cookie = opened.setCookie
      .find((c: string) => c.startsWith(`${EDIT_COOKIE}=`))
      ?.split(';')[0]
    const r = await page('/donor-survey/results', cookie)
    expect(has(r.text, GATE)).toBe(false)
  })
})

describe('D13 D14 a respondent sees the tallies, their own answers marked, and what happens next', () => {
  smoke('tallies, the marker key, how their answers are shared, a link to edit', async () => {
    const { token } = await save(answers({ email: email('d14'), share_with_funders: true }))
    const r = await page('/donor-survey/results', editCookie(token!))
    for (const part of [
      'Live tallies from',
      'Total giving planned for 2026',
      'Interest in each cause area',
      'Your own answers are in dark orange.',
      'What happens next',
      'Your answers will be shared with other major funders. You can change this anytime.',
      'Edit my answers',
    ])
      expect(has(r.text, part)).toBe(true)
  })
  standard(
    'private answers: "stay private"; an admin who didn’t answer gets no "What happens next"',
    async () => {
      const { token } = await save(answers({ email: email('d14-private') }))
      expect(
        has(
          (await page('/donor-survey/results', editCookie(token!))).text,
          'Your individual answers stay private'
        )
      ).toBe(true)
      expect(has((await rita.get('/donor-survey/results')).text, 'What happens next')).toBe(false)
    }
  )
})

describe('D15 published donors for respondents; every response for admins', () => {
  smoke(
    'a public response is listed with its donor page; the admin list shows only to admins',
    async () => {
      const pub = await person('d15-public')
      await save(answers({ is_public: true }), { cookie: await sessionOf(pub) })
      const priv = await person('d15-private')
      const privCookie = await sessionOf(priv)
      await save(answers(), { cookie: privCookie })
      const [{ id: privId }] =
        await sql`select id from donor_survey_responses where profile_id = ${priv.id}`

      const asRespondent = (await page('/donor-survey/results', privCookie)).text
      expect(has(asRespondent, `href="/${pub.username}/donor"`)).toBe(true)
      expect(has(asRespondent, `href="/${priv.username}/donor"`)).toBe(false)
      expect(has(asRespondent, 'All responses')).toBe(false)
      expect(has(asRespondent, `${pub.username}@local.test`)).toBe(false)

      const asAdmin = (await rita.get('/donor-survey/results')).text
      expect(has(asAdmin, 'All responses')).toBe(true)
      expect(has(asAdmin, `href="/donor-survey/responses/${privId}"`)).toBe(true)
      expect(has(asAdmin, `${priv.username}@local.test`)).toBe(true)
    }
  )
})

describe('D16 D17 D18 one donor’s answers at /<username>/donor', () => {
  smoke('public: everyone sees it, without the private answers', async () => {
    const pub = await person('d16-public')
    await save(
      answers({ is_public: true, advice_sources: `D16-${RUN}`, referrals: `REF-${RUN}` }),
      { cookie: await sessionOf(pub) }
    )
    const r = await anonymous().get(`/${pub.username}/donor`)
    expect(has(r.text, NOT_FOUND)).toBe(false)
    expect(has(r.text, `D16-${RUN}`)).toBe(true)
    expect(has(r.text, `REF-${RUN}`)).toBe(false)
    expect(has(r.text, `${pub.username}@local.test`)).toBe(false)
    expect(has(r.text, 'Not public yet')).toBe(false)
  })
  smoke('private: the donor and admins, with a note; anyone else gets not-found', async () => {
    const owner = await person('d16-private')
    const cookie = await sessionOf(owner)
    await save(answers({ advice_sources: `D16p-${RUN}`, referrals: `REFp-${RUN}` }), { cookie })
    const path = `/${owner.username}/donor`

    const mine = await page(path, cookie)
    for (const part of [
      `D16p-${RUN}`,
      `REFp-${RUN}`,
      'Not public yet. Only you and Manifund admins can see this',
      'Change that in the survey.',
    ])
      expect(has(mine.text, part)).toBe(true)
    const admin = await rita.get(path)
    expect(has(admin.text, `D16p-${RUN}`)).toBe(true)
    expect(has(admin.text, 'Only the donor and Manifund admins')).toBe(true)

    expect(has((await anonymous().get(path)).text, NOT_FOUND)).toBe(true)
    const other = await person('d16-other')
    const seen = (await page(path, await sessionOf(other))).text
    expect(has(seen, NOT_FOUND)).toBe(true)
    expect(has(seen, `D16p-${RUN}`)).toBe(false)
  })
  standard('someone who didn’t answer, and an unknown username: not-found', async () => {
    const none = await person('d16-none')
    expect(
      has((await page(`/${none.username}/donor`, await sessionOf(none))).text, NOT_FOUND)
    ).toBe(true)
    expect(has((await anonymous().get(`/${RUN}-nobody/donor`)).text, NOT_FOUND)).toBe(true)
  })
})

const DONOR_LINK = 'Donor survey answers'
describe('D19 the profile links to the donor page', () => {
  smoke('public: for everyone', async () => {
    const pub = await person('d19-public')
    await save(answers({ is_public: true }), { cookie: await sessionOf(pub) })
    const r = await anonymous().get(`/${pub.username}`)
    expect(has(r.text, `href="/${pub.username}/donor"`)).toBe(true)
    expect(has(r.text, DONOR_LINK)).toBe(true)
  })
  standard('private: only on the donor’s own profile; nobody answered: no link', async () => {
    const owner = await person('d19-private')
    const cookie = await sessionOf(owner)
    expect(has((await page(`/${owner.username}`, cookie)).text, DONOR_LINK)).toBe(false)
    await save(answers(), { cookie })
    expect(has((await page(`/${owner.username}`, cookie)).text, DONOR_LINK)).toBe(true)
    expect(has((await anonymous().get(`/${owner.username}`)).text, DONOR_LINK)).toBe(false)
  })
})

describe('D20 /donor-survey/responses/<id>: the account it belongs to and admins', () => {
  smoke('the owner and an admin see it; others get not-found', async () => {
    const owner = await person('d20')
    const cookie = await sessionOf(owner)
    await save(answers({ advice_sources: `D20-${RUN}` }), { cookie })
    const [{ id }] = await sql`select id from donor_survey_responses where profile_id = ${owner.id}`
    const path = `/donor-survey/responses/${id}`
    expect(has((await page(path, cookie)).text, `D20-${RUN}`)).toBe(true)
    expect(has((await rita.get(path)).text, `D20-${RUN}`)).toBe(true)
    const other = await person('d20-other')
    for (const text of [
      (await anonymous().get(path)).text,
      (await page(path, await sessionOf(other))).text,
    ]) {
      expect(has(text, NOT_FOUND)).toBe(true)
      expect(has(text, `D20-${RUN}`)).toBe(false)
    }
  })
  standard('a signed-out response, for admins (it has no username)', async () => {
    const e = email('d20-anon')
    const { token } = await save(answers({ email: e, advice_sources: `D20a-${RUN}` }))
    const [{ id }] = await sql`select id from donor_survey_responses where email = ${e}`
    const path = `/donor-survey/responses/${id}`
    expect(has((await rita.get(path)).text, `D20a-${RUN}`)).toBe(true)
    // its edit cookie doesn't open this page (signed-out respondents use the survey itself)
    expect(has((await page(path, editCookie(token!))).text, NOT_FOUND)).toBe(true)
  })
  standard('a malformed id: not-found', async () => {
    expect(has((await rita.get('/donor-survey/responses/not-an-id')).text, NOT_FOUND)).toBe(true)
  })
})
