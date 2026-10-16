// A proposal activates with exactly the funding offers the server checked (activate_proposal): any change to
// those offers in between, or a second activation, leaves everything as it was. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(
    import.meta.dir,
    '../../supabase/migrations/20261013170000_activate_proposal_checked_offers.sql'
  ),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// A grant proposal by alice with donation offers from bob (60) and rita (50).
async function setUp(tx: Tx) {
  await tx.unsafe(migration)
  const project = await makeProject(tx, p.alice.id, 'proposal', `activate-proposal-${Date.now()}`)
  const offer = async (bidder: string, amount: number) =>
    (
      await tx`insert into bids (project, bidder, amount, valuation, type, status)
               values (${project.id}, ${bidder}, ${amount}, 0, 'donate', 'pending') returning id`
    )[0].id as string
  return { project, bob: await offer(p.bob.id, 60), rita: await offer(p.rita.id, 50) }
}

async function activate(tx: Tx, projectId: string, offers: { id: string; amount: number }[]) {
  await tx`reset role`
  await tx`select activate_proposal(${projectId}::uuid, ${JSON.stringify(offers)}::text::jsonb)`
}

// Runs the call in a savepoint and returns its error message (or null), so the test can look at the
// state afterwards.
async function errorOf(tx: Tx, fn: (sp: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint(async (sp: Tx) => {
      await fn(sp)
    })
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function state(tx: Tx, projectId: string) {
  await tx`reset role`
  const [{ stage }] = await tx`select stage from projects where id = ${projectId}`
  const bids = await tx`select bidder, amount::float as amount, status from bids
                        where project = ${projectId} order by amount desc`
  const txns = await tx`select from_id, to_id, amount::float as amount, type from txns
                        where project = ${projectId} order by amount desc`
  return { stage, bids, txns }
}

describe('activating a proposal with the checked offers', () => {
  test('the checked offers become donations and the project becomes active', () =>
    inRollback(async (tx) => {
      const { project, bob, rita } = await setUp(tx)
      await activate(tx, project.id, [
        { id: bob, amount: 60 },
        { id: rita, amount: 50 },
      ])
      const s = await state(tx, project.id)
      expect(s.stage).toBe('active')
      expect(s.bids.map((b: any) => b.status)).toEqual(['accepted', 'accepted'])
      expect(s.txns).toEqual([
        { from_id: p.bob.id, to_id: p.alice.id, amount: 60, type: 'project donation' },
        { from_id: p.rita.id, to_id: p.alice.id, amount: 50, type: 'project donation' },
      ])
    }))

  test('an offer that was not checked stops the activation', () =>
    inRollback(async (tx) => {
      const { project, rita } = await setUp(tx)
      const before = await state(tx, project.id)
      const error = await errorOf(tx, (sp) => activate(sp, project.id, [{ id: rita, amount: 50 }]))
      expect(error).toContain('changed since they were checked')
      expect(await state(tx, project.id)).toEqual(before)
    }))

  test('an offer raised or set back to pending after the check stops the activation', () =>
    inRollback(async (tx) => {
      const { project, bob, rita } = await setUp(tx)
      // The check declined bob's offer; bob sets it back to pending with a larger amount.
      await tx`update bids set status = 'declined' where id = ${bob}`
      await actAs(tx, p.bob.id)
      await tx`update bids set status = 'pending', amount = 100000 where id = ${bob}`
      const before = await state(tx, project.id)
      const error = await errorOf(tx, (sp) => activate(sp, project.id, [{ id: rita, amount: 50 }]))
      expect(error).toContain('changed since they were checked')
      expect(await state(tx, project.id)).toEqual(before)

      await actAs(tx, p.rita.id)
      await tx`update bids set amount = 100000 where id = ${rita}`
      const error2 = await errorOf(tx, (sp) =>
        activate(sp, project.id, [
          { id: bob, amount: 60 },
          { id: rita, amount: 50 },
        ])
      )
      expect(error2).toContain('changed since they were checked')
    }))

  test('a checked offer that is no longer pending stops the activation', () =>
    inRollback(async (tx) => {
      const { project, bob, rita } = await setUp(tx)
      await actAs(tx, p.bob.id)
      await tx`update bids set status = 'deleted' where id = ${bob}`
      const error = await errorOf(tx, (sp) =>
        activate(sp, project.id, [
          { id: bob, amount: 60 },
          { id: rita, amount: 50 },
        ])
      )
      expect(error).toContain('changed since they were checked')
      expect((await state(tx, project.id)).stage).toBe('proposal')
    }))

  test('a project activates only once', () =>
    inRollback(async (tx) => {
      const { project, bob, rita } = await setUp(tx)
      const offers = [
        { id: bob, amount: 60 },
        { id: rita, amount: 50 },
      ]
      await activate(tx, project.id, offers)
      const error = await errorOf(tx, (sp) => activate(sp, project.id, offers))
      expect(error).toContain('is not a proposal')
      expect((await state(tx, project.id)).txns).toHaveLength(2)
    }))

  test('signed-in people cannot call it', () =>
    inRollback(async (tx) => {
      const { project, bob, rita } = await setUp(tx)
      const error = await errorOf(tx, async (sp) => {
        await actAs(sp, p.alice.id)
        await sp`select activate_proposal(${project.id}::uuid, ${JSON.stringify([
          { id: bob, amount: 60 },
          { id: rita, amount: 50 },
        ])}::text::jsonb)`
      })
      expect(error).toContain('permission denied')
      expect((await state(tx, project.id)).stage).toBe('proposal')
    }))

  test('a certificate proposal trades shares for the checked buy offers', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal', `activate-cert-${Date.now()}`)
      await tx`update projects set type = 'cert' where id = ${project.id}`
      await tx`insert into bids (project, bidder, amount, valuation, type, status)
               values (${project.id}, ${p.alice.id}, 100, 1000, 'assurance sell', 'pending')`
      const [{ id }] = await tx`insert into bids (project, bidder, amount, valuation, type, status)
               values (${project.id}, ${p.bob.id}, 100, 1000, 'assurance buy', 'pending') returning id`
      await activate(tx, project.id, [{ id, amount: 100 }])
      const s = await state(tx, project.id)
      expect(s.stage).toBe('active')
      expect(s.bids.map((b: any) => b.status)).toEqual(['accepted', 'accepted'])
      expect(s.txns).toEqual([
        { from_id: p.alice.id, to_id: p.bob.id, amount: 1000000, type: 'user to user trade' },
        { from_id: p.bob.id, to_id: p.alice.id, amount: 100, type: 'user to user trade' },
      ])
    }))
})
