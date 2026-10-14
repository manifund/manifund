// Certificate offers: when a new buy or sell offer arrives (the bids-table webhook), it trades with
// the matching offers on the project, each trade limited to the shares the seller holds and the
// balance the buyer has.
import { afterAll, describe, expect } from 'bun:test'
import { tempUser } from '../helpers/http'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN } from '../helpers/content'
import { standard } from '../helpers/levels'

const TOTAL_SHARES = 10_000_000
const projects: string[] = []

// An active certificate project; its creator holds every share (the "mint cert" txn the app makes).
async function certProject(creator: string) {
  const [p] = await sql`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round, description)
    values (${'Cert ' + RUN}, 'test', ${creator}, ${`${RUN}-cert-${projects.length}`}, 'active', 'cert', 100, 1000,
            ${TOTAL_SHARES}, 'Regrants', ${doc('A test certificate project.')})
    returning id`
  projects.push(p.id)
  await sql`insert into txns (from_id, to_id, amount, token, project, type)
            values (null, ${creator}, ${TOTAL_SHARES}, ${p.id}, ${p.id}, 'mint cert')`
  return p.id as string
}
const giveShares = (from: string, to: string, project: string, shares: number) =>
  sql`insert into txns (from_id, to_id, amount, token, project, type)
      values (${from}, ${to}, ${shares}, ${project}, ${project}, 'user to user trade')`
const deposit = (to: string, amount: number) =>
  sql`insert into txns (from_id, to_id, amount, token, type) values (null, ${to}, ${amount}, 'USD', 'deposit')`

// Inserts an offer as the database would take it, then calls the webhook the way the database does.
async function offer(
  bidder: string,
  project: string,
  type: string,
  amount: number,
  valuation: number
) {
  const [{ record }] = await sql`
    insert into bids (project, bidder, type, amount, valuation)
    values (${project}, ${bidder}, ${type}, ${amount}, ${valuation})
    returning to_jsonb(bids.*) as record`
  const res = await fetch(`${env.baseUrl}/api/handle-new-bid`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.webhookSecret}`,
    },
    body: JSON.stringify({
      type: 'INSERT',
      table: 'bids',
      schema: 'public',
      record,
      old_record: null,
    }),
  })
  expect(res.status).toBe(200)
  return record.id as string
}

const sharesOf = async (user: string, project: string) => {
  const [r] = await sql`
    select coalesce(sum(case when to_id = ${user} then amount else -amount end), 0) as n
    from txns where token = ${project} and (to_id = ${user} or from_id = ${user})`
  return Number(r.n)
}
const bidRow = async (id: string) => {
  const [r] = await sql`select amount, status from bids where id = ${id}`
  return { amount: Number(r.amount), status: r.status as string }
}
const tradeTxns = async (project: string) =>
  (
    await sql`select 1 from txns where project = ${project} and type = 'user to user trade' and token = 'USD'`
  ).length

afterAll(async () => {
  if (!projects.length) return
  await sql`delete from bids where project in ${sql(projects)}`
  await sql`delete from txns where project in ${sql(projects)}`
  await sql`delete from project_follows where project_id in ${sql(projects)}`
  await sql`delete from projects where id in ${sql(projects)}`
})

describe('certificate offers trade only what each side holds', () => {
  standard('a seller trades only the shares they hold; the buy offer keeps the rest', async () => {
    const [creator, seller, buyer] = await Promise.all([
      tempUser('cert-creator'),
      tempUser('cert-seller'),
      tempUser('cert-buyer'),
    ])
    const project = await certProject(creator.id)
    await giveShares(creator.id, seller.id, project, TOTAL_SHARES / 10) // 10%
    await deposit(buyer.id, 1000)

    // The seller offers 20% (they hold 10%), the creator 10%, both at a $1000 valuation.
    const sellerOffer = await offer(seller.id, project, 'sell', 200, 1000)
    const creatorOffer = await offer(creator.id, project, 'sell', 100, 1000)
    const buyerOffer = await offer(buyer.id, project, 'buy', 300, 1000)

    expect(await sharesOf(seller.id, project)).toBeCloseTo(0, 3)
    expect(await sharesOf(buyer.id, project)).toBeCloseTo(TOTAL_SHARES / 5, 3)
    expect(await sharesOf(creator.id, project)).toBeCloseTo((TOTAL_SHARES * 8) / 10, 3)
    expect(await tradeTxns(project)).toBe(2)
    // Both trades show in the new offer's row: $300 - $100 - $100.
    expect(await bidRow(buyerOffer)).toEqual({ amount: 100, status: 'pending' })
    expect(await bidRow(sellerOffer)).toEqual({ amount: 100, status: 'pending' })
    expect(await bidRow(creatorOffer)).toEqual({ amount: 0, status: 'accepted' })
  })

  standard("a buy offer without the balance doesn't trade; the next one does", async () => {
    const [creator, broke, buyer] = await Promise.all([
      tempUser('cert-creator2'),
      tempUser('cert-broke'),
      tempUser('cert-buyer2'),
    ])
    const project = await certProject(creator.id)
    await deposit(buyer.id, 1000)
    const brokeOffer = await offer(broke.id, project, 'buy', 50, 1500)
    const buyerOffer = await offer(buyer.id, project, 'buy', 100, 1000)
    const creatorOffer = await offer(creator.id, project, 'sell', 100, 1000)

    expect(await sharesOf(broke.id, project)).toBe(0)
    expect(await bidRow(brokeOffer)).toEqual({ amount: 50, status: 'pending' })
    expect(await sharesOf(buyer.id, project)).toBeCloseTo(TOTAL_SHARES / 10, 3)
    expect(await bidRow(buyerOffer)).toEqual({ amount: 0, status: 'accepted' })
    expect(await bidRow(creatorOffer)).toEqual({ amount: 0, status: 'accepted' })
  })

  standard('a new sell offer with no shares stays pending and trades nothing', async () => {
    const [creator, nobody, buyer] = await Promise.all([
      tempUser('cert-creator3'),
      tempUser('cert-noshares'),
      tempUser('cert-buyer3'),
    ])
    const project = await certProject(creator.id)
    await deposit(buyer.id, 1000)
    await deposit(nobody.id, 1000)
    const buyerOffer = await offer(buyer.id, project, 'buy', 100, 1000)
    const sellOffer = await offer(nobody.id, project, 'sell', 100, 500)

    expect(await tradeTxns(project)).toBe(0)
    expect(await bidRow(sellOffer)).toEqual({ amount: 100, status: 'pending' })
    expect(await bidRow(buyerOffer)).toEqual({ amount: 100, status: 'pending' })
  })

  standard('only buy and sell offers trade with each other', async () => {
    const [creator, donor, buyer] = await Promise.all([
      tempUser('cert-creator4'),
      tempUser('cert-donor'),
      tempUser('cert-buyer4'),
    ])
    const project = await certProject(creator.id)
    await deposit(buyer.id, 1000)
    await deposit(donor.id, 1000)
    const buyerOffer = await offer(buyer.id, project, 'buy', 100, 1000)
    for (const type of ['donate', 'assurance sell', 'assurance buy']) {
      await offer(donor.id, project, type, 50, 1)
    }

    expect(await tradeTxns(project)).toBe(0)
    expect(await sharesOf(donor.id, project)).toBe(0)
    expect(await bidRow(buyerOffer)).toEqual({ amount: 100, status: 'pending' })
  })

  standard("the creator's buy offers on their own project draw on their cash balance", async () => {
    const [creator, seller] = await Promise.all([
      tempUser('cert-creator5'),
      tempUser('cert-seller5'),
    ])
    const project = await certProject(creator.id)
    await giveShares(creator.id, seller.id, project, TOTAL_SHARES / 10)
    // A deposit is charity balance for someone not accredited: not enough to buy into their own project.
    await deposit(creator.id, 1000)
    const sellOffer = await offer(seller.id, project, 'sell', 100, 1000)
    const creatorOffer = await offer(creator.id, project, 'buy', 100, 1000)

    expect(await tradeTxns(project)).toBe(0)
    expect(await bidRow(sellOffer)).toEqual({ amount: 100, status: 'pending' })
    expect(await bidRow(creatorOffer)).toEqual({ amount: 100, status: 'pending' })
  })

  standard(
    'a seller selling into a higher buy offer trades all their shares at that price',
    async () => {
      const [creator, seller, buyer] = await Promise.all([
        tempUser('cert-creator6'),
        tempUser('cert-seller6'),
        tempUser('cert-buyer6'),
      ])
      const project = await certProject(creator.id)
      await giveShares(creator.id, seller.id, project, TOTAL_SHARES / 10) // 10%
      await deposit(buyer.id, 1000)
      // The buyer pays up to $400 at a $2000 valuation; the seller asks $1000 for 50% (holds 10%).
      const buyerOffer = await offer(buyer.id, project, 'buy', 400, 2000)
      const sellOffer = await offer(seller.id, project, 'sell', 500, 1000)

      // 10% at the buy offer's $2000 valuation: $200.
      expect(await sharesOf(seller.id, project)).toBeCloseTo(0, 3)
      expect(await sharesOf(buyer.id, project)).toBeCloseTo(TOTAL_SHARES / 10, 3)
      expect(await bidRow(buyerOffer)).toEqual({ amount: 200, status: 'pending' })
      expect(await bidRow(sellOffer)).toEqual({ amount: 300, status: 'pending' })
    }
  )
})
