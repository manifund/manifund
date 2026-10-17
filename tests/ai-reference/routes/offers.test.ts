// Offers and activation (docs/ai-reference/offers) through the app: placing an offer, what the page shows, the database
// webhook (a new offer reaches /api/handle-new-bid through the local database's webhook trigger), and activation after an admin's
// approval. Donors, creators and the funder who gives donors their balance are the file's own people; rita (a
// shared account) is the admin, through people.ts's guarded client (the verdict is one of her allowed actions).
import { beforeAll, describe, expect, test } from 'bun:test'
import { anonymous, type Client } from '../helpers/http'
import { as, person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { RUN } from '../helpers/content'
import { slow, smoke, standard } from '../helpers/levels'

let creator: Client, donor: Client, saver: Client, poor: Client, funder: Client, rita: Client

beforeAll(async () => {
  ;[creator, donor, saver, poor, funder, rita] = await Promise.all([
    person('creator'),
    person('donor'),
    person('saver'),
    person('poor'),
    person('funder'),
    as('rita'),
  ])
  // Charity balances, given as profile donations: the donor has plenty, `saver` exactly $1,000, `poor` nothing.
  await sql`insert into txns (from_id, to_id, amount, token, type)
            values (${funder.id}, ${donor.id}, 100000, 'USD', 'profile donation'),
                   (${funder.id}, ${saver.id}, 1000, 'USD', 'profile donation')`
})

let n = 0
// A grant proposal by the file's creator. Unapproved unless said otherwise, so the webhook doesn't activate it.
async function proposal(fields: Record<string, unknown> = {}) {
  const project = await makeProject(sql, creator.id, 'proposal', `${RUN}-o${++n}`)
  if (Object.keys(fields).length)
    await sql`update projects set ${sql(fields)} where id = ${project.id}`
  return project
}
const offer = (
  who: Client,
  projectId: string,
  amount: unknown,
  extra: Record<string, unknown> = {}
) => who.post('/api/place-bid', { projectId, valuation: 0, amount, type: 'donate', ...extra })
const bidsOn = (projectId: string) =>
  sql`select bidder, amount::float as amount, valuation::float as valuation, type, status from bids
      where project = ${projectId} order by created_at`

// The webhook runs after the insert, on its own: wait for what it does.
async function until<T>(
  check: () => Promise<T | undefined | false>,
  ms = 15_000
): Promise<T | undefined> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await check()
    if (v) return v
    await Bun.sleep(250)
  }
  return undefined
}
const follows = async (projectId: string, who: string) =>
  (
    await sql`select 1 from project_follows where project_id = ${projectId} and follower_id = ${who}`
  ).length > 0

describe('B1 B4 placing an offer', () => {
  smoke('visitors are refused', async () => {
    const project = await proposal()
    expect((await offer(anonymous(), project.id, 50)).status).toBe(401)
    expect(await bidsOn(project.id)).toHaveLength(0)
  })
  standard('the amount must be a positive number and the valuation not negative', async () => {
    const project = await proposal()
    for (const [amount, valuation] of [
      [0, 0],
      [-5, 0],
      ['ten', 0],
      [null, 0],
      [50, -1],
    ] as const) {
      const r = await offer(donor, project.id, amount, { valuation })
      expect(r.status).toBe(400)
    }
    expect(await bidsOn(project.id)).toHaveLength(0)
  })
  smoke('a valid offer is saved as sent, pending, in the signed-in person’s name', async () => {
    const project = await proposal()
    expect((await offer(donor, project.id, 50)).status).toBe(200)
    expect(await bidsOn(project.id)).toEqual([
      { bidder: donor.id, amount: 50, valuation: 0, type: 'donate', status: 'pending' },
    ])
  })
})

describe('B2 an offer must fit the bidder’s balance', () => {
  standard('someone with no balance is refused, and nothing is saved', async () => {
    const project = await proposal()
    const r = await offer(poor, project.id, 50)
    expect(r.status).toBe(401)
    expect(r.text).toBe('Insufficient funds')
    expect(await bidsOn(project.id)).toHaveLength(0)
  })
  standard('pending offers count against the balance', async () => {
    const a = await proposal()
    const b = await proposal()
    await offer(saver, a.id, 700)
    expect(await bidsOn(a.id)).toHaveLength(1)
    const r = await offer(saver, b.id, 400) // 1,000 - 700 left
    expect(r.status).toBe(401)
    expect(await bidsOn(b.id)).toHaveLength(0)
    await sql`update bids set status = 'deleted' where project = ${a.id}` // B8: withdrawn, the money is free again
    await offer(saver, b.id, 400)
    expect(await bidsOn(b.id)).toHaveLength(1)
  })
})

describe('B3 an offer on a project that does not exist', () => {
  standard('is refused with 404', async () => {
    const r = await offer(donor, '00000000-0000-0000-0000-000000000000', 10)
    expect(r.status).toBe(404)
  })
})

describe('B5 the donate box on a grant proposal', () => {
  standard('offered while short of the funding goal; "fully funded" at the goal', async () => {
    const project = await proposal({ funding_goal: 200 })
    const before = await donor.get(`/projects/${project.slug}`)
    expect(before.status).toBe(200)
    expect(before.text).toContain('Offer to donate')
    // React separates the amount and the text with an empty comment in the HTML.
    expect(before.text.replaceAll('<!-- -->', '')).toContain('$200 left to reach the funding goal.') // B22
    await sql`insert into bids (project, bidder, amount, valuation, type) values (${project.id}, ${donor.id}, 200, 0, 'donate')`
    const after = await donor.get(`/projects/${project.slug}`)
    expect(after.text).not.toContain('Offer to donate')
    expect(after.text).toContain('Fully funded and not currently accepting donations.')
  })
})

describe('B20 the server applies the donate box’s limits to donation offers on a grant proposal', () => {
  standard('below $10 is refused with the reason, and nothing is saved', async () => {
    const project = await proposal()
    const r = await offer(donor, project.id, 5)
    expect(r.status).toBe(400)
    expect(r.text).toBe('The minimum is $10.')
    expect(await bidsOn(project.id)).toHaveLength(0)
  })
  standard('past what is left of the funding goal (pending offers count) is refused', async () => {
    const project = await proposal({ funding_goal: 200 })
    expect((await offer(saver, project.id, 150)).status).toBe(200)
    const over = await offer(donor, project.id, 60)
    expect(over.status).toBe(400)
    expect(over.text).toBe(
      'This project needs $50 more to reach its funding goal, so you can give up to $50.'
    )
    expect((await offer(donor, project.id, 50)).status).toBe(200)
    const full = await offer(donor, project.id, 10)
    expect(full.status).toBe(400)
    expect(full.text).toBe(
      'This project has reached its funding goal and is not accepting more donations.'
    )
    expect((await bidsOn(project.id)).map((b: any) => b.amount)).toEqual([150, 50])
  })
  standard('a withdrawn offer frees its share of the goal', async () => {
    const project = await proposal({ funding_goal: 100 })
    await offer(saver, project.id, 100)
    await sql`update bids set status = 'deleted' where project = ${project.id}`
    expect((await offer(donor, project.id, 100)).status).toBe(200)
  })
  standard('with less than $10 left, exactly what is left is accepted', async () => {
    const project = await proposal({ funding_goal: 104 })
    await offer(donor, project.id, 100)
    expect((await offer(donor, project.id, 3)).status).toBe(400)
    expect((await offer(donor, project.id, 4)).status).toBe(200)
  })
})

describe('B6 an offer makes the bidder follow the project', () => {
  standard('through the webhook', async () => {
    const project = await proposal()
    await offer(donor, project.id, 20)
    expect(await until(() => follows(project.id, donor.id))).toBe(true)
  })
})

describe('B7 the webhook only acts on requests carrying its secret', () => {
  smoke('no secret, or a wrong one: 401', async () => {
    const project = await proposal()
    const record = {
      project: project.id,
      bidder: donor.id,
      amount: 1,
      type: 'donate',
      status: 'pending',
    }
    for (const authorization of [undefined, 'Bearer wrong']) {
      const r = await fetch(`${env.baseUrl}/api/handle-new-bid`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({
          type: 'INSERT',
          table: 'bids',
          schema: 'public',
          record,
          old_record: null,
        }),
      })
      expect(r.status).toBe(401)
    }
    expect(await follows(project.id, donor.id)).toBe(false)
  })
})

describe('B10 whichever condition comes last activates the project', () => {
  slow('the offer that reaches the minimum activates an approved, signed proposal', async () => {
    const project = await proposal({ min_funding: 100, approved: true, signed_agreement: true })
    await offer(donor, project.id, 60)
    expect(await until(() => follows(project.id, donor.id))).toBe(true) // the webhook ran
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe(
      'proposal'
    )
    await offer(donor, project.id, 40)
    const active = await until(
      async () =>
        (await sql`select stage from projects where id = ${project.id}`)[0].stage === 'active'
    )
    expect(active).toBe(true)
    const txns = await sql`select from_id, to_id, amount::float as amount, type from txns
                           where project = ${project.id} order by amount desc`
    expect(txns).toEqual([
      { from_id: donor.id, to_id: creator.id, amount: 60, type: 'project donation' },
      { from_id: donor.id, to_id: creator.id, amount: 40, type: 'project donation' },
    ])
  })
  slow('an admin’s approval activates a signed proposal that already has its minimum', async () => {
    const project = await proposal({ min_funding: 100, signed_agreement: true })
    await offer(donor, project.id, 100)
    expect(await until(() => follows(project.id, donor.id))).toBe(true)
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe(
      'proposal'
    )
    const r = await rita.post('/api/issue-grant-verdict', {
      approved: true,
      projectId: project.id,
      adminComment: null,
      publicBenefit: 'test',
    })
    expect(r.status).toBe(200)
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe('active')
    expect(
      await sql`select 1 from txns where project = ${project.id} and type = 'project donation'`
    ).toHaveLength(1)
  })
  standard('without approval, an offer that reaches the minimum activates nothing', async () => {
    const project = await proposal({ min_funding: 100, signed_agreement: true })
    await offer(donor, project.id, 150)
    expect(await until(() => follows(project.id, donor.id))).toBe(true)
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe(
      'proposal'
    )
    expect(await sql`select 1 from txns where project = ${project.id}`).toHaveLength(0)
  })
  // The third trigger, signing the grant agreement, belongs to the agreements area's route tests (A rules).
})

describe('offers open question 1 (docs/ai-reference/offers/README.md)', () => {
  // An assurance buy that overshoots what a certificate needs by under $1 becomes a negative amount, which the
  // database refuses. Turn on once the rounding is fixed.
  test.skip('a certificate offer just past what is needed is saved, rounded to fund it exactly', async () => {
    const project = await proposal({ type: 'cert' })
    await sql`insert into bids (project, bidder, amount, valuation, type)
              values (${project.id}, ${creator.id}, 100, 1000, 'assurance sell')`
    await offer(donor, project.id, 100.5, { type: 'assurance buy', valuation: 1000 })
    const buys =
      await sql`select amount::float as amount from bids where project = ${project.id} and type = 'assurance buy'`
    expect(buys as unknown[]).toEqual([{ amount: 100 }])
  })
})
