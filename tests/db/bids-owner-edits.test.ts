// People can withdraw their own pending offers and nothing else about them; the server still makes every
// change it makes today. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(import.meta.dir, '../../supabase/migrations/20261014173411_bids_owner_edits_limited.sql'),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

type Offer = { status?: string; amount?: number; valuation?: number; type?: string }

// An offer by `bidder` on `project`, inserted by the server.
async function makeOffer(tx: Tx, project: string, bidder: string, o: Offer = {}) {
  await tx`reset role`
  const [r] = await tx`
    insert into bids (project, bidder, amount, valuation, type, status)
    values (${project}, ${bidder}, ${o.amount ?? 100}, ${o.valuation ?? 0}, ${o.type ?? 'donate'},
            ${o.status ?? 'pending'})
    returning id`
  return r.id as string
}

async function offer(tx: Tx, id: string) {
  await tx`reset role`
  const [r] =
    await tx`select project, bidder, amount::float as amount, valuation::float as valuation, type, status,
                    created_at from bids where id = ${id}`
  return r
}

describe('people can only withdraw their own pending offers', () => {
  test('withdrawing a pending offer still works, as the site does it', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const id = await makeOffer(tx, project.id, p.bob.id)
      await actAs(tx, p.bob.id)
      await tx`update bids set status = 'deleted' where id = ${id}`
      expect((await offer(tx, id)).status).toBe('deleted')
    }))

  test('amount, valuation, type, project and date keep their values', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal', `bids-a-${Date.now()}`)
      const other = await makeProject(tx, p.alice.id, 'proposal', `bids-b-${Date.now()}`)
      const id = await makeOffer(tx, project.id, p.bob.id, { amount: 100, valuation: 0 })
      const before = await offer(tx, id)
      await actAs(tx, p.bob.id)
      await tx`update bids set amount = 5000, valuation = 9000, type = 'buy', project = ${other.id},
                 created_at = '2020-01-01' where id = ${id}`
      expect(await offer(tx, id)).toEqual(before)
    }))

  test('withdrawing keeps everything else as it was', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const id = await makeOffer(tx, project.id, p.bob.id, { amount: 100 })
      await actAs(tx, p.bob.id)
      await tx`update bids set status = 'deleted', amount = 5000 where id = ${id}`
      const r = await offer(tx, id)
      expect(r.status).toBe('deleted')
      expect(r.amount).toBe(100)
    }))

  test('declined, accepted and withdrawn offers keep their status', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const declined = await makeOffer(tx, project.id, p.bob.id, { status: 'declined' })
      const accepted = await makeOffer(tx, project.id, p.bob.id, { status: 'accepted' })
      const withdrawn = await makeOffer(tx, project.id, p.bob.id, { status: 'deleted' })
      const pending = await makeOffer(tx, project.id, p.bob.id)
      await actAs(tx, p.bob.id)
      await tx`update bids set status = 'pending' where id in (${declined}, ${withdrawn})`
      await tx`update bids set status = 'deleted' where id = ${accepted}`
      await tx`update bids set status = 'accepted' where id = ${pending}`
      expect((await offer(tx, declined)).status).toBe('declined')
      expect((await offer(tx, withdrawn)).status).toBe('deleted')
      expect((await offer(tx, accepted)).status).toBe('accepted')
      expect((await offer(tx, pending)).status).toBe('pending')
    }))

  test("someone else's offer and visitors still can't change anything", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const id = await makeOffer(tx, project.id, p.bob.id)
      await actAs(tx, p.alice.id)
      await tx`update bids set status = 'deleted' where id = ${id}`
      await actAsAnon(tx)
      await tx`update bids set status = 'deleted' where id = ${id}`
      expect((await offer(tx, id)).status).toBe('pending')
    }))
})

describe('new offers from people start pending', () => {
  test("an insert from a person's client starts pending and is dated now", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await actAs(tx, p.bob.id)
      const [{ id }] = await tx`
        insert into bids (project, bidder, amount, valuation, type, status, created_at)
        values (${project.id}, ${p.bob.id}, 100, 0, 'donate', 'accepted', '2020-01-01')
        returning id`
      const r = await offer(tx, id)
      expect(r.status).toBe('pending')
      expect(new Date(r.created_at).getFullYear()).toBeGreaterThan(2020)
    }))

  test('the place-offer route and project creation still insert offers as before', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await actAs(tx, p.bob.id)
      // pages/api/place-bid.ts
      const [placed] = await tx`
        insert into bids (id, project, bidder, amount, valuation, type, status)
        values (${crypto.randomUUID()}, ${project.id}, ${p.bob.id}, 250, 0, 'donate', 'pending')
        returning id`
      // db/bid.ts insertBid, from create-project / publish-project (a prize project's own sell offer)
      await actAs(tx, p.alice.id)
      const [sell] = await tx`
        insert into bids (project, bidder, amount, valuation, type)
        values (${project.id}, ${p.alice.id}, 50, 1000, 'assurance sell')
        returning id`
      const a = await offer(tx, placed.id)
      expect(a.status).toBe('pending')
      expect(a.amount).toBe(250)
      const b = await offer(tx, sell.id)
      expect(b.status).toBe('pending')
      expect(b.type).toBe('assurance sell')
      expect(b.valuation).toBe(1000)
    }))

  test("a regrantor's grant still creates its offer (give_grant_v2)", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const id = crypto.randomUUID()
      const project = {
        id,
        creator: p.alice.id,
        title: 'Grant',
        blurb: 'b',
        description: null,
        min_funding: 100,
        funding_goal: 1000,
        founder_shares: 10000000,
        type: 'grant',
        stage: 'proposal',
        round: 'Regrants',
        slug: `bids-g-${Date.now()}`,
        location_description: null,
        lobbying: false,
      }
      await actAs(tx, p.bob.id)
      await tx`select give_grant_v2(
                 json_populate_record(null::project_row, ${project}::json),
                 json_populate_record(null::bid_row, ${{ project: id, amount: 300, bidder: p.bob.id }}::json))`
      await tx`reset role`
      const [r] =
        await tx`select amount::float as amount, status, type from bids where project = ${id}`
      expect(r).toEqual({ amount: 300, status: 'pending', type: 'donate' })
    }))
})

describe('the server still changes offers as it does today', () => {
  test('trades, closing and restoring a project (service role)', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const traded = await makeOffer(tx, project.id, p.bob.id, { amount: 100, type: 'buy' })
      const declined = await makeOffer(tx, project.id, p.bob.id, { status: 'declined' })
      await tx`set local role service_role`
      // utils/trade.ts updateBidFromTrade (from handle-new-bid)
      await tx`update bids set amount = 40, status = 'pending' where id = ${traded}`
      // pages/api/restore-project.ts
      await tx`update bids set status = 'pending' where id = ${declined}`
      expect((await offer(tx, traded)).amount).toBe(40)
      expect((await offer(tx, declined)).status).toBe('pending')
      // utils/resolve-auction.ts inserts and updates as the service role, any status
      await tx`set local role service_role`
      const [{ id }] = await tx`
        insert into bids (project, bidder, amount, valuation, type, status)
        values (${project.id}, ${p.alice.id}, 10, 1000, 'sell', 'accepted') returning id`
      expect((await offer(tx, id)).status).toBe('accepted')
    }))

  test('activation accepts pending offers and moves the money (activate_grant)', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const id = await makeOffer(tx, project.id, p.bob.id, { amount: 120 })
      await tx`set local role service_role`
      await tx`select activate_grant(${project.id}, ${p.alice.id})`
      expect((await offer(tx, id)).status).toBe('accepted')
      const [t] = await tx`select amount::float as amount from txns
                           where project = ${project.id} and from_id = ${p.bob.id}`
      expect(t.amount).toBe(120)
    }))

  test('closing an unfunded proposal declines its offers (reject_proposal)', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      const id = await makeOffer(tx, project.id, p.bob.id)
      await tx`set local role service_role`
      await tx`select reject_proposal(${project.id})`
      expect((await offer(tx, id)).status).toBe('declined')
    }))
})
