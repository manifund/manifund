// The grant SQL functions run with the owner's rights and can be called through the REST API, so they
// check what the create-grant route checks. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(import.meta.dir, '../../supabase/migrations/20261111120000_lock_grant_rpcs_and_votes.sql'),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

function project(creator: string) {
  const id = crypto.randomUUID()
  return {
    id,
    creator,
    title: 'Grant',
    blurb: 'test',
    description: { type: 'doc', content: [] },
    min_funding: 100,
    funding_goal: 100,
    founder_shares: 10000000,
    round: 'Regrants',
    slug: `grant-${id}`,
    location_description: 'Earth',
    lobbying: false,
  }
}

async function setup(tx: Tx) {
  await tx.unsafe(migration)
  await tx`update profiles set regranter_status = (id = ${p.alice.id}) where id in (${p.alice.id}, ${p.bob.id})`
}

const giveGrant = (tx: Tx, proj: object, donation: object) =>
  tx`select give_grant_v2(json_populate_record(null::project_row, ${proj}),
                          json_populate_record(null::bid_row, ${donation}))`

const transferGrant = (tx: Tx, proj: object, transfer: object, amount: number) =>
  tx`select create_transfer_grant_v2(json_populate_record(null::project_row, ${proj}),
                                     json_populate_record(null::transfer_row, ${transfer}), ${amount})`

describe('P12 only regrantors give grants, and a grant only touches the project it creates', () => {
  test('a regrantor gives a grant to another account', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const proj = project(p.bob.id)
      await actAs(tx, p.alice.id)
      await giveGrant(tx, proj, { project: proj.id, amount: 50, bidder: p.alice.id })
      await tx`reset role`
      const [row] = await tx`select creator, stage from projects where id = ${proj.id}`
      expect(row).toEqual({ creator: p.bob.id, stage: 'proposal' })
    }))

  test('someone who is not a regrantor cannot create a project in another account’s name', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const proj = project(p.alice.id)
      await actAs(tx, p.bob.id)
      await expect(
        giveGrant(tx, proj, { project: proj.id, amount: 50, bidder: p.bob.id })
      ).rejects.toThrow()
    }))

  test('a grant of nothing is refused', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const proj = project(p.bob.id)
      await actAs(tx, p.alice.id)
      await expect(
        giveGrant(tx, proj, { project: proj.id, amount: 0, bidder: p.alice.id })
      ).rejects.toThrow()
    }))

  test('the donation goes to the new project, not another one', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const other = await makeProject(tx, p.rita.id, 'proposal', `other-${Date.now()}`)
      const proj = project(p.bob.id)
      await actAs(tx, p.alice.id)
      await expect(
        giveGrant(tx, proj, { project: other.id, amount: 50, bidder: p.alice.id })
      ).rejects.toThrow()
    }))

  test('a held account cannot give a grant', () =>
    inRollback(async (tx) => {
      await setup(tx)
      await tx`insert into account_holds (profile_id, checked_username, held_at) values (${p.alice.id}, 'alice', now())
               on conflict (profile_id) do update set held_at = now(), cleared_at = null`
      const proj = project(p.bob.id)
      await actAs(tx, p.alice.id)
      await expect(
        giveGrant(tx, proj, { project: proj.id, amount: 50, bidder: p.alice.id })
      ).rejects.toThrow('account pending review')
    }))

  test('a grant to an email creates a transfer for the new project', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const proj = project(p.alice.id)
      await actAs(tx, p.alice.id)
      await transferGrant(
        tx,
        proj,
        { recipient_email: 'new@example.com', recipient_name: 'New', project_id: proj.id },
        50
      )
      await tx`reset role`
      const transfers =
        await tx`select project_id from project_transfers where recipient_email = 'new@example.com'`
      expect(transfers.map((t: { project_id: string }) => t.project_id)).toEqual([proj.id])
    }))

  test('a transfer cannot be planted on someone else’s project', () =>
    inRollback(async (tx) => {
      await setup(tx)
      const victim = await makeProject(tx, p.rita.id, 'active', `victim-${Date.now()}`)
      const proj = project(p.alice.id)
      await actAs(tx, p.alice.id)
      await expect(
        transferGrant(
          tx,
          proj,
          { recipient_email: 'thief@example.com', recipient_name: 'T', project_id: victim.id },
          50
        )
      ).rejects.toThrow()
    }))
})

describe('P13 one vote per person per project, worth -1, 0 or 1, cast as yourself', () => {
  test('people vote and change their vote', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const proj = await makeProject(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await tx`insert into project_votes (project_id, voter_id, magnitude) values (${proj.id}, ${p.bob.id}, 1)`
      await tx`update project_votes set magnitude = -1 where project_id = ${proj.id} and voter_id = ${p.bob.id}`
      await tx`reset role`
      const votes = await tx`select magnitude from project_votes where project_id = ${proj.id}`
      expect(votes.map((v: { magnitude: number }) => v.magnitude)).toEqual([-1])
    }))

  test('a vote cast as someone else is refused', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const proj = await makeProject(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await expect(
        tx`insert into project_votes (project_id, voter_id, magnitude) values (${proj.id}, ${p.rita.id}, 1)`
      ).rejects.toThrow()
    }))

  test('a vote worth more than 1 is refused', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const proj = await makeProject(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await expect(
        tx`insert into project_votes (project_id, voter_id, magnitude) values (${proj.id}, ${p.bob.id}, 100)`
      ).rejects.toThrow()
    }))

  test('a second vote on the same project is refused', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const proj = await makeProject(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await tx`insert into project_votes (project_id, voter_id, magnitude) values (${proj.id}, ${p.bob.id}, 1)`
      await expect(
        tx`insert into project_votes (project_id, voter_id, magnitude) values (${proj.id}, ${p.bob.id}, 1)`
      ).rejects.toThrow()
    }))
})
