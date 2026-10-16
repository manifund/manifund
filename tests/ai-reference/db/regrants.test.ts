// Regrants and verdicts (docs/ai-reference/regrants): the SQL functions behind giving a grant (give_grant_v2,
// create_transfer_grant_v2) and an admin's verdict (execute_grant_verdict_v2), checked on the money: projects,
// offers (bids), txns. Every test runs in a rolled-back transaction; alice gives, bob receives.
import { beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// The project the create-grant route builds (app/api/create-grant/route.ts).
const grantProject = (creator: string, fields: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  creator,
  title: `Grant ${RUN}`,
  blurb: 'test',
  description: doc('What the grantee will do.'),
  min_funding: 100,
  funding_goal: 1000,
  founder_shares: 10_000_000,
  type: 'grant',
  stage: 'proposal',
  round: 'Regrants',
  slug: `${RUN}-grant-${randomUUID().slice(0, 8)}`,
  location_description: 'Somewhere',
  lobbying: false,
  ...fields,
})

// Async wrappers: Bun's tagged queries only run when awaited, and expect(...).rejects doesn't await them.
const giveGrant = async (tx: Tx, project: Record<string, unknown>, donation: Record<string, unknown>) =>
  await tx`select give_grant_v2(jsonb_populate_record(null::project_row, ${project}::jsonb),
                          jsonb_populate_record(null::bid_row, ${donation}::jsonb))`
const transferGrant = async (tx: Tx, project: Record<string, unknown>, transfer: Record<string, unknown>, amount: unknown) =>
  await tx`select create_transfer_grant_v2(jsonb_populate_record(null::project_row, ${project}::jsonb),
                                     jsonb_populate_record(null::transfer_row, ${transfer}::jsonb),
                                     ${amount}::numeric)`
const verdict = async (tx: Tx, approved: boolean, projectId: string, adminId: string, benefit: string | null) =>
  await tx`select execute_grant_verdict_v2(${approved}, ${projectId}::uuid, ${adminId}::uuid, ${benefit})`

// A grant from alice to bob (a person on Manifund), made as alice. Returns the project.
async function grantToBob(tx: Tx, amount = 500) {
  const project = grantProject(p.bob.id)
  await actAs(tx, p.alice.id)
  await giveGrant(tx, project, { project: project.id, amount, bidder: p.alice.id })
  await tx`reset role`
  return project
}

describe('G5 G6 a grant to a person on Manifund: a new proposal that is theirs, plus the regrantor\'s offer', () => {
  test('the project, the offer and the follow are written together; no money moves', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx, 500)
      const [row] = await tx`select creator, type, stage, round, approved, signed_agreement,
                                    founder_shares::int as founder_shares from projects where id = ${project.id}`
      expect(row).toEqual({
        creator: p.bob.id, type: 'grant', stage: 'proposal', round: 'Regrants', approved: null,
        signed_agreement: false, founder_shares: 10_000_000,
      })
      const bids = await tx`select bidder, amount, type, status, valuation from bids where project = ${project.id}`
      expect(bids).toHaveLength(1)
      expect(bids[0]).toMatchObject({ bidder: p.alice.id, type: 'donate', status: 'pending' })
      expect(Number(bids[0].amount)).toBe(500)
      expect(Number(bids[0].valuation)).toBe(0)
      expect(await tx`select 1 from project_follows where project_id = ${project.id} and follower_id = ${p.alice.id}`)
        .toHaveLength(1)
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
  test('approved and signed agreement come from the function, not from the caller', () =>
    inRollback(async (tx) => {
      const project = { ...grantProject(p.bob.id), approved: true, signed_agreement: true }
      await actAs(tx, p.alice.id)
      await giveGrant(tx, project, { project: project.id, amount: 100, bidder: p.alice.id })
      await tx`reset role`
      const [row] = await tx`select approved, signed_agreement from projects where id = ${project.id}`
      expect(row).toEqual({ approved: null, signed_agreement: false })
    }))
  test('all or nothing: when the offer can\'t be written, the project isn\'t either', () =>
    inRollback(async (tx) => {
      const project = grantProject(p.bob.id)
      await tx`savepoint before_grant`
      await actAs(tx, p.alice.id)
      // The offer names a project that doesn't exist, so its insert fails after the project's.
      await expect(giveGrant(tx, project, { project: randomUUID(), amount: 100, bidder: p.alice.id })).rejects.toThrow()
      await tx`rollback to savepoint before_grant`
      expect(await tx`select 1 from projects where id = ${project.id}`).toHaveLength(0)
      expect(await tx`select 1 from bids where project = ${project.id}`).toHaveLength(0)
    }))
})

describe('G5 G7 a grant to someone not on Manifund: the regrantor holds the project until the recipient signs up', () => {
  test('the project is the regrantor\'s, with the recipient\'s name and email kept beside it', () =>
    inRollback(async (tx) => {
      const project = grantProject(p.alice.id)
      const email = `${RUN}-newcomer@example.test`
      await actAs(tx, p.alice.id)
      await transferGrant(tx, project, { recipient_email: email, recipient_name: 'New Comer', project_id: project.id }, 250)
      await tx`reset role`
      const [row] = await tx`select creator, stage, round, approved from projects where id = ${project.id}`
      expect(row).toEqual({ creator: p.alice.id, stage: 'proposal', round: 'Regrants', approved: null })
      const [transfer] = await tx`select recipient_email, recipient_name, transferred from project_transfers
                                  where project_id = ${project.id}`
      expect(transfer).toEqual({ recipient_email: email, recipient_name: 'New Comer', transferred: false })
      const bids = await tx`select bidder, amount, type, status from bids where project = ${project.id}`
      expect(bids).toHaveLength(1)
      expect(bids[0]).toMatchObject({ bidder: p.alice.id, type: 'donate', status: 'pending' })
      expect(Number(bids[0].amount)).toBe(250)
      expect(await tx`select 1 from project_follows where project_id = ${project.id} and follower_id = ${p.alice.id}`)
        .toHaveLength(1)
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
})

describe('G8 the database refuses a grant in someone else\'s name, from a visitor, or with a bad amount', () => {
  const refused = (fn: (tx: Tx) => Promise<unknown>, message: string) =>
    inRollback(async (tx) => {
      await expect(fn(tx)).rejects.toThrow(message)
    })

  test('an offer in another person\'s name', () =>
    refused(async (tx) => {
      const project = grantProject(p.bob.id)
      await actAs(tx, p.alice.id)
      await giveGrant(tx, project, { project: project.id, amount: 100, bidder: p.rita.id })
    }, 'caller mismatch'))
  test('a grant to an email whose project names someone else as creator', () =>
    refused(async (tx) => {
      const project = grantProject(p.rita.id)
      await actAs(tx, p.alice.id)
      await transferGrant(tx, project, { recipient_email: 'x@example.test', recipient_name: 'X', project_id: project.id }, 100)
    }, 'caller mismatch'))
  test('a visitor (not signed in)', () =>
    refused(async (tx) => {
      const project = grantProject(p.bob.id)
      await actAsAnon(tx)
      await giveGrant(tx, project, { project: project.id, amount: 100, bidder: p.alice.id })
    }, 'caller mismatch'))
  test('a negative amount', () =>
    refused(async (tx) => {
      const project = grantProject(p.bob.id)
      await actAs(tx, p.alice.id)
      await giveGrant(tx, project, { project: project.id, amount: -1, bidder: p.alice.id })
    }, 'invalid amount'))
  test('a missing amount', () =>
    refused(async (tx) => {
      const project = grantProject(p.alice.id)
      await actAs(tx, p.alice.id)
      await transferGrant(tx, project, { recipient_email: 'x@example.test', recipient_name: 'X', project_id: project.id }, null)
    }, 'invalid amount'))
  test('a $0 contribution is accepted (a grant that only asks other donors)', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx, 0)
      expect(await tx`select 1 from projects where id = ${project.id}`).toHaveLength(1)
    }))
})

describe('G9 the offer becomes money only when the project activates', () => {
  test('at activation, the regrantor\'s offer becomes a project donation to the recipient', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx, 500)
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
      // What the offers area's activation does once the project is approved, signed and at its minimum.
      await tx`select activate_grant(${project.id}::uuid, ${p.bob.id}::uuid)`
      const txns = await tx`select from_id, to_id, amount, token, type from txns where project = ${project.id}`
      expect(txns).toHaveLength(1)
      expect(txns[0]).toMatchObject({ from_id: p.alice.id, to_id: p.bob.id, token: 'USD', type: 'project donation' })
      expect(Number(txns[0].amount)).toBe(500)
      const [bid] = await tx`select status from bids where project = ${project.id}`
      expect(bid.status).toBe('accepted')
    }))
})

describe('G13 approving records the approval, the public benefit and the agreement\'s approver; nothing else', () => {
  test('approved, benefit and agreement set; stage, offers and money unchanged', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx, 500)
      await tx`insert into grant_agreements (project_id) values (${project.id})`
      await verdict(tx, true, project.id, p.rita.id, 'Education')
      const [row] = await tx`select approved, public_benefit, stage from projects where id = ${project.id}`
      expect(row).toEqual({ approved: true, public_benefit: 'Education', stage: 'proposal' })
      const [agreement] = await tx`select approved_by, approved_at from grant_agreements where project_id = ${project.id}`
      expect(agreement.approved_by).toBe(p.rita.id)
      expect(agreement.approved_at).not.toBeNull()
      const [bid] = await tx`select status from bids where project = ${project.id}`
      expect(bid.status).toBe('pending')
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
  test('only this project\'s agreement is marked approved', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx)
      const other = await makeProject(tx, p.bob.id, 'proposal', `${RUN}-other`)
      await tx`insert into grant_agreements (project_id) values (${project.id}), (${other.id})`
      await verdict(tx, true, project.id, p.rita.id, 'Education')
      const [row] = await tx`select approved_by from grant_agreements where project_id = ${other.id}`
      expect(row.approved_by).toBeNull()
    }))
})

describe('G14 rejecting: not approved, not funded, pending offers declined', () => {
  test('pending offers are declined; accepted offers and donations already made stay', () =>
    inRollback(async (tx) => {
      const project = await grantToBob(tx, 500)
      // An earlier offer already accepted, with its donation (as if the project had activated before).
      await tx`insert into bids (project, bidder, amount, type, status, valuation)
               values (${project.id}, ${p.rita.id}, 50, 'donate', 'accepted', 0)`
      await tx`insert into txns (from_id, to_id, project, amount, token, type)
               values (${p.rita.id}, ${p.bob.id}, ${project.id}, 50, 'USD', 'project donation')`
      await verdict(tx, false, project.id, p.rita.id, null)
      const [row] = await tx`select approved, stage from projects where id = ${project.id}`
      expect(row).toEqual({ approved: false, stage: 'not funded' })
      const bids = await tx`select bidder, status from bids where project = ${project.id} order by amount`
      expect(bids.map((b: any) => [b.bidder, b.status])).toEqual([
        [p.rita.id, 'accepted'],
        [p.alice.id, 'declined'],
      ])
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(1)
    }))
})

describe('G15 the verdict function is for the server\'s service role only', () => {
  test('a signed-in person (even the creator) can\'t call it', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.bob.id, 'proposal', `${RUN}-self-verdict`)
      await actAs(tx, p.bob.id)
      await expect(verdict(tx, true, project.id, p.bob.id, 'Education')).rejects.toThrow('permission denied')
    }))
  test('a visitor can\'t call it', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.bob.id, 'proposal', `${RUN}-anon-verdict`)
      await actAsAnon(tx)
      await expect(verdict(tx, true, project.id, p.bob.id, 'Education')).rejects.toThrow('permission denied')
    }))
})

describe('G18 Community Choice roles: one set per person, public to read, written only by that person', () => {
  test('anyone can read them', () =>
    inRollback(async (tx) => {
      await tx`delete from profile_roles where id = ${p.bob.id}`
      await tx`insert into profile_roles (id, donor) values (${p.bob.id}, true)`
      await actAsAnon(tx)
      expect((await tx`select donor from profile_roles where id = ${p.bob.id}`) as unknown[]).toEqual([{ donor: true }])
    }))
  test('a person can write their own, once', () =>
    inRollback(async (tx) => {
      await tx`delete from profile_roles where id = ${p.bob.id}`
      await actAs(tx, p.bob.id)
      await tx`insert into profile_roles (id, donor, scholar) values (${p.bob.id}, true, 'test')`
      await expect((async () => await tx`insert into profile_roles (id, donor) values (${p.bob.id}, false)`)()).rejects.toThrow('duplicate key')
    }))
  test('nobody can write someone else\'s', () =>
    inRollback(async (tx) => {
      await tx`delete from profile_roles where id in (${p.alice.id}, ${p.bob.id})`
      await tx`insert into profile_roles (id, donor) values (${p.alice.id}, false)`
      await actAs(tx, p.bob.id)
      const updated = await tx`update profile_roles set donor = true where id = ${p.alice.id} returning id`
      expect(updated).toHaveLength(0)
      await expect((async () => await tx`insert into profile_roles (id, donor) values (${p.rita.id}, true)`)()).rejects.toThrow('row-level security')
    }))
})
