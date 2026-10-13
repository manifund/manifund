// Only the server sets a project's approval, signed agreement, type and creator; creators keep editing
// the rest. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(
    import.meta.dir,
    '../../supabase/migrations/20261012191625_project_approval_server_only.sql'
  ),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function row(tx: Tx, id: string) {
  await tx`reset role`
  const [r] =
    await tx`select approved, signed_agreement, type, creator, title from projects where id = ${id}`
  return r
}

describe('project approval is set by the server only', () => {
  test("a creator's update keeps approval, agreement, type and creator, and saves the rest", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await actAs(tx, p.alice.id)
      await tx`update projects set approved = true, signed_agreement = true, type = 'cert',
                 creator = ${p.bob.id}, title = 'New title' where id = ${project.id}`
      const r = await row(tx, project.id)
      expect(r.approved).toBeNull()
      expect(r.signed_agreement).toBe(false)
      expect(r.type).toBe('grant')
      expect(r.creator).toBe(p.alice.id)
      expect(r.title).toBe('New title')
    }))
  test('a project inserted by a signed-in person starts unapproved and unsigned', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await actAs(tx, p.alice.id)
      const [{ id }] = await tx`
        insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal,
                              founder_shares, round, approved, signed_agreement)
        values ('t', 't', ${p.alice.id}, ${'approval-' + Date.now()}, 'proposal', 'grant', 100, 1000,
                10000000, 'Regrants', true, true)
        returning id`
      const r = await row(tx, id)
      expect(r.approved).toBeNull()
      expect(r.signed_agreement).toBe(false)
    }))
  test('the server still approves and marks agreements signed', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await tx`set local role service_role`
      await tx`update projects set approved = true, signed_agreement = true where id = ${project.id}`
      const r = await row(tx, project.id)
      expect(r.approved).toBe(true)
      expect(r.signed_agreement).toBe(true)
    }))

  test("an admin's verdict and a project transfer, both run by the server, still apply", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const approved = await makeProject(tx, p.alice.id, 'proposal', `approval-a-${Date.now()}`)
      const rejected = await makeProject(tx, p.alice.id, 'proposal', `approval-r-${Date.now()}`)
      const [transfer] =
        await tx`insert into project_transfers (recipient_email, recipient_name, project_id)
                                  values (${p.bob.email}, 'Bob', ${approved.id}) returning id`
      await tx`set local role service_role`
      await tx`select execute_grant_verdict_v2(true, ${approved.id}, ${p.rita.id}, 'Benefit')`
      await tx`select execute_grant_verdict_v2(false, ${rejected.id}, ${p.rita.id}, null)`
      await tx`select _transfer_project(${approved.id}, ${p.bob.id}, ${transfer.id})`
      const a = await row(tx, approved.id)
      expect(a.approved).toBe(true)
      expect(a.creator).toBe(p.bob.id)
      const r = await row(tx, rejected.id)
      expect(r.approved).toBe(false)
    }))
  test("a regrantor's grant creates the project unapproved, as before", () =>
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
        slug: `approval-g-${Date.now()}`,
        location_description: null,
        lobbying: false,
      }
      await actAs(tx, p.bob.id)
      await tx`select give_grant_v2(
                 json_populate_record(null::project_row, ${project}::json),
                 json_populate_record(null::bid_row, ${{ project: id, amount: 100, bidder: p.bob.id }}::json))`
      const r = await row(tx, id)
      expect(r.approved).toBeNull()
      expect(r.signed_agreement).toBe(false)
      expect(r.creator).toBe(p.alice.id)
    }))
  test('a creator still creates a prize project as a certificate', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await actAs(tx, p.alice.id)
      const [{ id }] = await tx`
        insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal,
                              founder_shares, round)
        values ('t', 't', ${p.alice.id}, ${'approval-c-' + Date.now()}, 'active', 'cert', 0, 0,
                5000000, 'Regrants')
        returning id`
      const r = await row(tx, id)
      expect(r.type).toBe('cert')
    }))
})
