// Only the server moves a project to a stage that follows a decision or a funding outcome; people keep
// publishing, closing and hiding their own projects. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(import.meta.dir, '../../supabase/migrations/20261016120000_project_stage_server_only.sql'),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function row(tx: Tx, id: string) {
  await tx`reset role`
  const [r] = await tx`select stage, type, title from projects where id = ${id}`
  return r
}

// The creator moves their own project from one stage to another; returns the stage that was saved.
async function creatorMoves(tx: Tx, from: string, to: string) {
  await tx`reset role`
  const project = await makeProject(tx, p.alice.id, from, `stage-${from}-${to}-${Date.now()}`)
  await actAs(tx, p.alice.id)
  await tx`update projects set stage = ${to}::project_stage, title = 'Edited' where id = ${project.id}`
  const r = await row(tx, project.id)
  expect(r.title).toBe('Edited')
  return r.stage
}

describe('P1: project stage is set by the server, apart from the moves people make themselves', () => {
  test('people publish a draft, close an active project and hide their project', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      expect(await creatorMoves(tx, 'draft', 'proposal')).toBe('proposal')
      expect(await creatorMoves(tx, 'active', 'complete')).toBe('complete')
      expect(await creatorMoves(tx, 'proposal', 'hidden')).toBe('hidden')
      expect(await creatorMoves(tx, 'active', 'hidden')).toBe('hidden')
      expect(await creatorMoves(tx, 'draft', 'hidden')).toBe('hidden')
    }))

  test('other moves keep the current stage, and the rest of the update is saved', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      expect(await creatorMoves(tx, 'proposal', 'active')).toBe('proposal')
      expect(await creatorMoves(tx, 'draft', 'active')).toBe('draft')
      expect(await creatorMoves(tx, 'not funded', 'active')).toBe('not funded')
      expect(await creatorMoves(tx, 'proposal', 'not funded')).toBe('proposal')
      expect(await creatorMoves(tx, 'hidden', 'proposal')).toBe('hidden')
      expect(await creatorMoves(tx, 'complete', 'active')).toBe('complete')
      expect(await creatorMoves(tx, 'proposal', 'complete')).toBe('proposal')
    }))

  test('a project inserted by a signed-in person starts as a proposal or a draft', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await actAs(tx, p.alice.id)
      const insert = (stage: string) => tx`
        insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal,
                              founder_shares, round)
        values ('t', 't', ${p.alice.id}, ${`stage-insert-${stage}-${Date.now()}`}, ${stage}::project_stage,
                'grant', 100, 1000, 10000000, 'Regrants')
        returning id`
      const [active] = await insert('active')
      const [complete] = await insert('complete')
      const [draft] = await insert('draft')
      expect((await row(tx, active.id)).stage).toBe('proposal')
      expect((await row(tx, complete.id)).stage).toBe('proposal')
      expect((await row(tx, draft.id)).stage).toBe('draft')
    }))

  test('the server still moves projects to any stage', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await tx`set local role service_role`
      await tx`update projects set stage = 'active' where id = ${project.id}`
      expect((await row(tx, project.id)).stage).toBe('active')
      await tx`set local role service_role`
      await tx`update projects set stage = 'not funded' where id = ${project.id}`
      expect((await row(tx, project.id)).stage).toBe('not funded')
    }))

  test("a regrant's new project is a grant proposal, whatever stage and type the caller sends", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const projectRow = (slug: string) => ({
        id: crypto.randomUUID(),
        creator: p.alice.id,
        title: 'Regrant',
        blurb: 'b',
        min_funding: 100,
        funding_goal: 1000,
        founder_shares: 10000000,
        type: 'cert',
        stage: 'active',
        round: 'Regrants',
        slug,
        lobbying: false,
      })
      const given = projectRow(`stage-give-${Date.now()}`)
      await actAs(tx, p.rita.id)
      await tx`select give_grant_v2(
        json_populate_record(null::project_row, ${given}::json),
        json_populate_record(null::bid_row, ${{ project: given.id, amount: 0, bidder: p.rita.id }}::json))`
      expect(await row(tx, given.id)).toMatchObject({ stage: 'proposal', type: 'grant' })

      const transferred = projectRow(`stage-transfer-${Date.now()}`)
      await actAs(tx, p.alice.id)
      await tx`select create_transfer_grant_v2(
        json_populate_record(null::project_row, ${transferred}::json),
        json_populate_record(null::transfer_row,
          ${{ recipient_email: 'stage-test@example.com', recipient_name: 'R', project_id: transferred.id }}::json),
        0)`
      expect(await row(tx, transferred.id)).toMatchObject({ stage: 'proposal', type: 'grant' })
    }))
})
