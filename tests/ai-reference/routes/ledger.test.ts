// Balances and the ledger (docs/ai-reference/ledger/README.md): donations (L13-L16), the profile's balances (L12), grants
// claimed at sign-up (L18-L20) and /finances (L21-L23). Money is given to this file's own people by inserting
// txns directly (as a deposit would); every row is deleted with them at the end.
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, client, cookieForEmail, type Client } from '../helpers/http'
import { getPeople, person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { RUN } from '../helpers/content'
import { env } from '../helpers/env'
import { smoke, standard } from '../helpers/levels'

// Manifund's bank account (the other side of deposits and withdrawals), looked up once.
let BANK: string
const give = (to: string, amount: number) =>
  sql`insert into txns (from_id, to_id, amount, token, type) values (${BANK}, ${to}, ${amount}, 'USD', 'deposit')`

const donate = (
  who: Client,
  body: { fromId: string; toId: string; amount: number; projectId?: string }
) => who.post('/api/transfer-money', body)

const txnsFrom = (id: string) =>
  sql`select to_id, amount::float, type, project from txns where from_id = ${id} and type in ('project donation', 'profile donation') order by created_at`

let creator: Client, project: { id: string; slug: string }, draft: { id: string; slug: string }
beforeAll(async () => {
  ;[{ id: BANK }] = await sql`select id from profiles where username = 'Manifund-Bank'`
  creator = await person('creator')
  project = await makeProject(sql, creator.id, 'active', `${RUN}-active`)
  draft = await makeProject(sql, creator.id, 'draft', `${RUN}-draft`)
})

describe('L13 donating from the charity balance', () => {
  smoke(
    'to a project: the money goes to its creator, as a project donation naming the project',
    async () => {
      const donor = await person('donor-project')
      await give(donor.id, 100)
      const r = await donate(donor, {
        fromId: donor.id,
        toId: creator.id,
        amount: 40,
        projectId: project.id,
      })
      expect(r.status).toBe(200)
      expect(await txnsFrom(donor.id)).toEqual([
        { to_id: creator.id, amount: 40, type: 'project donation', project: project.id },
      ])
    }
  )
  standard("to an account (e.g. a regrantor's budget): a profile donation", async () => {
    const donor = await person('donor-profile')
    const regrantor = await person('regrantor-budget')
    await give(donor.id, 100)
    const r = await donate(donor, { fromId: donor.id, toId: regrantor.id, amount: 25 })
    expect(r.status).toBe(200)
    expect(await txnsFrom(donor.id)).toEqual([
      { to_id: regrantor.id, amount: 25, type: 'profile donation', project: null },
    ])
  })
  standard('visitors can not donate', async () => {
    const donor = await person('donor-project')
    const r = await anonymous().post('/api/transfer-money', {
      fromId: donor.id,
      toId: creator.id,
      amount: 1,
    })
    expect(r.status).not.toBe(200)
  })
})

describe('L14 a donation stays within the charity balance', () => {
  standard('more than the charity balance is refused', async () => {
    const donor = await person('donor-over')
    await give(donor.id, 50)
    const r = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: 51,
      projectId: project.id,
    })
    expect(r.status).not.toBe(200)
    expect(await txnsFrom(donor.id)).toEqual([])
  })
  standard('pending offers count as spent', async () => {
    const donor = await person('donor-offers')
    await give(donor.id, 100)
    // An offer on a draft: the new-offer webhook only follows the project (no activation outside proposals).
    await sql`insert into bids (project, bidder, amount, valuation, type, status)
              values (${draft.id}, ${donor.id}, 80, 0, 'donate', 'pending')`
    const refused = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: 30,
      projectId: project.id,
    })
    expect(refused.status).not.toBe(200)
    const fits = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: 20,
      projectId: project.id,
    })
    expect(fits.status).toBe(200)
    expect((await txnsFrom(donor.id)).map((t: any) => t.amount)).toEqual([20])
  })
  standard('a negative amount is refused', async () => {
    const donor = await person('donor-negative')
    await give(donor.id, 100)
    const r = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: -10,
      projectId: project.id,
    })
    expect(r.status).not.toBe(200)
    expect(await txnsFrom(donor.id)).toEqual([])
  })
  standard('cash (money received by your projects) is not charity money', async () => {
    const grantee = await person('donor-cash-only')
    await sql`insert into txns (from_id, to_id, amount, token, type, project)
              values (${creator.id}, ${grantee.id}, 100, 'USD', 'project donation', ${project.id})`
    const r = await donate(grantee, {
      fromId: grantee.id,
      toId: creator.id,
      amount: 10,
      projectId: project.id,
    })
    expect(r.status).not.toBe(200)
    expect(await txnsFrom(grantee.id)).toEqual([])
  })
})

describe('L14 B21 a donation to a grant project: at least $10, and not past its funding goal', () => {
  standard('below $10, or past what is left of the goal, is refused with the reason', async () => {
    const small = await makeProject(sql, creator.id, 'active', `${RUN}-capped`)
    await sql`update projects set funding_goal = 100 where id = ${small.id}`
    const donor = await person('donor-capped')
    await give(donor.id, 500)
    const tooLittle = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: 5,
      projectId: small.id,
    })
    expect(tooLittle.status).toBe(400)
    expect(tooLittle.text).toBe('The minimum is $10.')
    expect(
      (await donate(donor, { fromId: donor.id, toId: creator.id, amount: 70, projectId: small.id }))
        .status
    ).toBe(200)
    const tooMuch = await donate(donor, {
      fromId: donor.id,
      toId: creator.id,
      amount: 40,
      projectId: small.id,
    })
    expect(tooMuch.status).toBe(400)
    expect(tooMuch.text).toBe(
      'This project needs $30 more to reach its funding goal, so you can give up to $30.'
    )
    expect(
      (await donate(donor, { fromId: donor.id, toId: creator.id, amount: 30, projectId: small.id }))
        .status
    ).toBe(200)
    expect((await txnsFrom(donor.id)).map((t: any) => t.amount)).toEqual([70, 30])
  })
  standard('a donation to a person (no project) has no goal to respect', async () => {
    const donor = await person('donor-no-goal')
    const to = await person('no-goal-to')
    await give(donor.id, 5000)
    expect((await donate(donor, { fromId: donor.id, toId: to.id, amount: 2000 })).status).toBe(200)
  })
})

describe('L15 only the owner, or an admin, moves money from an account', () => {
  standard("someone else can't donate from your account", async () => {
    const owner = await person('donor-owner')
    const other = await person('not-the-owner')
    await give(owner.id, 100)
    const r = await donate(other, { fromId: owner.id, toId: other.id, amount: 10 })
    expect(r.status).not.toBe(200)
    expect(await txnsFrom(owner.id)).toEqual([])
  })
  standard("an admin can, within that account's charity balance", async () => {
    // rita is the local admin. A profile donation between this file's people changes none of rita's rows, but
    // people.ts's guard only lets her moderate and give verdicts, so this client skips the guard (the run's
    // shared-account check still applies).
    const { rita } = await getPeople()
    const admin = client(rita.id, rita.username, await cookieForEmail(rita.email))
    const from = await person('admin-from')
    const to = await person('admin-to')
    await give(from.id, 100)
    expect((await donate(admin, { fromId: from.id, toId: to.id, amount: 101 })).status).not.toBe(
      200
    )
    expect((await donate(admin, { fromId: from.id, toId: to.id, amount: 60 })).status).toBe(200)
    expect(await txnsFrom(from.id)).toEqual([
      { to_id: to.id, amount: 60, type: 'profile donation', project: null },
    ])
  })
})

describe('L16 donating to a project follows it', () => {
  standard('the donor follows the project', async () => {
    const donor = await person('donor-follows')
    await give(donor.id, 10)
    expect(
      (
        await donate(donor, {
          fromId: donor.id,
          toId: creator.id,
          amount: 10,
          projectId: project.id,
        })
      ).status
    ).toBe(200)
    const follows =
      await sql`select 1 from project_follows where project_id = ${project.id} and follower_id = ${donor.id}`
    expect(follows).toHaveLength(1)
  })
  // Fix (Vals 2026-10-09): following was a plain insert, so a second donation answered 500 after the money moved.
  standard(
    'a second donation by a donor who already follows answers 200, still one follow',
    async () => {
      const donor = await person('donor-follows-twice')
      await give(donor.id, 20)
      const body = { fromId: donor.id, toId: creator.id, amount: 10, projectId: project.id }
      expect((await donate(donor, body)).status).toBe(200)
      expect((await donate(donor, body)).status).toBe(200)
      const follows =
        await sql`select 1 from project_follows where project_id = ${project.id} and follower_id = ${donor.id}`
      expect(follows).toHaveLength(1)
    }
  )
})

// The value a profile shows above a balance label, e.g. "$70" above "charity balance".
const stat = (html: string, label: string) =>
  html.match(new RegExp(`>(-?\\$[\\d,.]+)</span><span[^>]*>${label}<`))?.[1]

describe('L12 a profile never shows a negative cash balance', () => {
  standard('negative cash shows as $0 and comes off the charity balance shown', async () => {
    const someone = await person('negative-cash')
    await give(someone.id, 100) // charity 100
    await sql`insert into txns (from_id, to_id, amount, token, type) values (${someone.id}, ${BANK}, 30, 'USD', 'withdraw')`
    // computed: total 70, charity 100, cash -30
    const page = await anonymous().get(`/${someone.username}`)
    expect(page.status).toBe(200)
    expect(stat(page.text, 'total balance')).toBe('$70')
    expect(stat(page.text, 'cash balance')).toBe('$0')
    expect(stat(page.text, 'charity balance')).toBe('$70')
  })
})

describe('L18-L20 grants to people without an account', () => {
  const transferTo = async (email: string, stage = 'active', name: string, done = false) => {
    const regrantor = await person('regrantor')
    const p = await makeProject(sql, regrantor.id, stage, `${RUN}-${name}`)
    await sql`update projects set title = ${`Ledger ${name} ${RUN}`} where id = ${p.id}`
    const [t] =
      await sql`insert into project_transfers (recipient_email, recipient_name, project_id, transferred)
                          values (${email}, 'New person', ${p.id}, ${done}) returning id`
    return { ...p, transferId: t.id as string, regrantor }
  }
  const waitFor = async (check: () => Promise<boolean>, ms = 15000) => {
    for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(250))
      if (await check()) return true
    return false
  }

  smoke(
    'L18 L19 signing up claims the pending transfers to that email; done ones are left alone',
    async () => {
      const email = `${RUN}-claimer@local.test` // what person('claimer') signs up with
      const pending = await transferTo(email, 'active', 'pending')
      const done = await transferTo(email, 'active', 'done', true)
      const visible = await makeProject(sql, pending.regrantor.id, 'active', `${RUN}-visible`)
      await sql`update projects set title = ${`Ledger visible ${RUN}`} where id = ${visible.id}`
      const [{ count: txnsBefore }] =
        await sql`select count(*)::int from txns where project in (${pending.id}, ${done.id})`

      // L19: before the sign-up, the regrantor's profile lists the project without a pending transfer only. (The
      // page's data, sent to the browser, has both: what counts is the rendered list, where titles are text nodes.)
      const before = await anonymous().get(`/${pending.regrantor.username}`)
      expect(before.text).toContain(`>Ledger visible ${RUN}<`)
      expect(before.text).not.toContain(`>Ledger pending ${RUN}<`)

      const claimer = await person('claimer') // the sign-up's webhook calls /api/transfer-project
      const claimed = await waitFor(async () => {
        const [r] = await sql`select creator from projects where id = ${pending.id}`
        return r.creator === claimer.id
      })
      expect(claimed).toBe(true)
      const [t] =
        await sql`select transferred from project_transfers where id = ${pending.transferId}`
      expect(t.transferred).toBe(true)
      const [d] = await sql`select creator from projects where id = ${done.id}`
      expect(d.creator).toBe(done.regrantor.id)
      const [{ count: txnsAfter }] =
        await sql`select count(*)::int from txns where project in (${pending.id}, ${done.id})`
      expect(txnsAfter).toBe(txnsBefore) // no money moves at that step
    }
  )

  standard(
    'L18 a transfer sent to the email typed with capitals is claimed too (Vals 2026-10-09: fix)',
    async () => {
      const email = `${RUN}-capitals@local.test` // what person('capitals') signs up with, in lowercase
      const pending = await transferTo(email.toUpperCase(), 'active', 'capitals')
      const claimer = await person('capitals')
      const claimed = await waitFor(async () => {
        const [r] = await sql`select creator from projects where id = ${pending.id}`
        return r.creator === claimer.id
      })
      expect(claimed).toBe(true)
    }
  )

  standard('L20 the webhook refuses calls without its secret', async () => {
    const body = {
      record: { id: '00000000-0000-4000-8000-000000000000', email: `${RUN}-nobody@local.test` },
    }
    expect((await anonymous().post('/api/transfer-project', body)).status).toBe(401)
    const wrong = await fetch(`${env.baseUrl}/api/transfer-project`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-the-secret' },
      body: JSON.stringify(body),
    })
    expect(wrong.status).toBe(401)
  })
})

describe('L21-L23 /finances', () => {
  // The page embeds its rows (username, full name, balance) in the payload the browser renders the grid from.
  type Row = { username: string | null; balance: number }
  let html = ''
  let rows: Row[] = []
  let rich: Client, poor: Client
  beforeAll(async () => {
    rich = await person('finances-rich')
    poor = await person('finances-poor')
    await give(rich.id, 2000.6)
    await give(poor.id, 1000.4)
    const page = await anonymous().get('/finances')
    expect(page.status).toBe(200)
    html = page.text
    const unq = (s: string) => (s === 'null' ? null : s.slice(2, -2))
    rows = [
      ...html.matchAll(
        /\\"username\\":(\\"(?:[^"\\]|\\\\.)*?\\"|null),\\"full_name\\":(?:\\"(?:[^"\\]|\\\\.)*?\\"|null),\\"balance\\":(-?[\d.]+)/g
      ),
    ].map((m) => ({ username: unq(m[1]), balance: Number(m[2]) }))
  })

  smoke(
    'L21 public: each account with its total balance, rounded to the dollar, highest first',
    () => {
      expect(rows.find((r) => r.username === rich.username)?.balance).toBe(2001)
      expect(rows.find((r) => r.username === poor.username)?.balance).toBe(1000)
      expect(rows.every((r) => Number.isInteger(r.balance))).toBe(true)
      expect(rows.every((r, i) => i === 0 || rows[i - 1].balance >= r.balance)).toBe(true)
    }
  )
  standard('L21 no email addresses on the page', () => {
    expect(html).not.toContain(`${rich.username}@local.test`)
    expect(html).not.toContain(`${poor.username}@local.test`)
    expect(html).not.toMatch(/\\"email\\":/) // no email field in the rows sent to the browser
  })
  standard('L22 the total leaves out Manifund-Bank', () => {
    const bank = rows.find((r) => r.username === 'Manifund-Bank')
    expect(bank).toBeDefined()
    const shown = Number(
      html
        .match(
          /Total \(excluding &quot;Manifund Bank&quot; account\):(?:<!-- -->| )*(-?)\$([\d,]+)/
        )!
        .slice(1)
        .join('')
        .replace(/,/g, '')
    )
    const withoutBank = rows.reduce((a, r) => a + r.balance, 0) - bank!.balance
    // Rows the pattern above might miss don't move the total by a bank-sized amount.
    expect(Math.abs(shown - withoutBank)).toBeLessThan(Math.max(1000, Math.abs(bank!.balance) / 2))
  })
  standard('L23 the balance sheet is typed in, dated, and says values are estimates', () => {
    expect(html).toContain('All values are estimates')
    expect(html).toMatch(/Last updated: (<!-- -->)?\d{4}-\d{2}-\d{2}/)
    expect(html).toContain('Manifund balance sheet') // its rows are drawn in the browser, from figures in the code
  })
})
