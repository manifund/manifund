// Causes, rounds, funds, programs (docs/ai-reference/causes): what the database guarantees about causes, rounds and a
// project's causes. Every test runs in a rolled-back transaction, on a cause and a round it makes itself (real
// causes and rounds are only read).
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

const CAUSE = `${RUN}-cause`
const ROUND = `Round ${RUN}`

// Async wrappers: Bun's tagged queries only run when awaited, and expect(...).rejects doesn't await them.
async function makeCause(tx: Tx, fields: { prize?: boolean; open?: boolean } = {}) {
  await tx`insert into causes (slug, title, header_image_url, prize, open)
           values (${CAUSE}, ${'Cause ' + RUN}, 'https://example.test/header.png', ${fields.prize ?? false},
                   ${fields.open ?? true})`
}
async function makeRound(tx: Tx) {
  await tx`insert into rounds (title, slug) values (${ROUND}, ${RUN + '-round'})`
}
const link = async (tx: Tx, projectId: string, slug = CAUSE) =>
  await tx`insert into project_causes (project_id, cause_slug) values (${projectId}, ${slug})`

describe('R1 causes, rounds and project causes are public', () => {
  test("a visitor reads a cause, a round and a project's causes", () =>
    inRollback(async (tx) => {
      await makeCause(tx, { prize: true, open: false })
      await makeRound(tx)
      const project = await makeProject(tx, p.alice.id)
      await link(tx, project.id)
      await actAsAnon(tx)
      const [cause] = await tx`select prize, open from causes where slug = ${CAUSE}`
      expect(cause).toEqual({ prize: true, open: false })
      expect(await tx`select 1 from rounds where title = ${ROUND}`).toHaveLength(1)
      expect(
        (await tx`select cause_slug from project_causes where project_id = ${project.id}`) as unknown[]
      ).toEqual([{ cause_slug: CAUSE }])
    }))
  test('a signed-in person reads them too', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      await actAs(tx, p.bob.id)
      expect(await tx`select 1 from causes where slug = ${CAUSE}`).toHaveLength(1)
    }))
})

describe("R2 other people don't add, change or delete causes or rounds", () => {
  test('a signed-in person changing a cause changes nothing', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      await actAs(tx, p.alice.id)
      const updated =
        await tx`update causes set title = 'changed' where slug = ${CAUSE} returning slug`
      expect(updated).toHaveLength(0)
      const deleted = await tx`delete from causes where slug = ${CAUSE} returning slug`
      expect(deleted).toHaveLength(0)
    }))
  test('a visitor changing a cause changes nothing', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      await actAsAnon(tx)
      expect(
        await tx`update causes set open = false where slug = ${CAUSE} returning slug`
      ).toHaveLength(0)
      expect(await tx`delete from causes where slug = ${CAUSE} returning slug`).toHaveLength(0)
    }))
  test("a signed-in person can't add a cause", () =>
    inRollback(async (tx) => {
      await actAs(tx, p.alice.id)
      await expect(makeCause(tx)).rejects.toThrow('row-level security')
    }))
  test('a signed-in person changing a round changes nothing', () =>
    inRollback(async (tx) => {
      await makeRound(tx)
      await actAs(tx, p.alice.id)
      expect(
        await tx`update rounds set retro_pool = 1 where title = ${ROUND} returning slug`
      ).toHaveLength(0)
      expect(await tx`delete from rounds where title = ${ROUND} returning slug`).toHaveLength(0)
    }))
  test("a signed-in person can't add a round", () =>
    inRollback(async (tx) => {
      await actAs(tx, p.alice.id)
      await expect(makeRound(tx)).rejects.toThrow('row-level security')
    }))
})

describe("R7 a project's causes: each once, existing causes only, gone with the project", () => {
  test('a project can be in several causes', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      const project = await makeProject(tx, p.alice.id)
      const [other] = await tx`select slug from causes where slug <> ${CAUSE} limit 1`
      await link(tx, project.id)
      await link(tx, project.id, other.slug)
      expect(await tx`select 1 from project_causes where project_id = ${project.id}`).toHaveLength(
        2
      )
    }))
  test('the same cause twice is refused', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      const project = await makeProject(tx, p.alice.id)
      await link(tx, project.id)
      await expect(link(tx, project.id)).rejects.toThrow('project_causes_pkey')
    }))
  test("a cause that doesn't exist is refused", () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      await expect(link(tx, project.id, `${RUN}-no-such-cause`)).rejects.toThrow(
        'project_causes_cause_slug_fkey'
      )
    }))
  test('deleting a project removes its links to causes', () =>
    inRollback(async (tx) => {
      await makeCause(tx)
      const project = await makeProject(tx, p.alice.id)
      await link(tx, project.id)
      await tx`delete from projects where id = ${project.id}`
      expect(await tx`select 1 from project_causes where cause_slug = ${CAUSE}`).toHaveLength(0)
    }))
})

describe('R11 every project is in a round that exists', () => {
  test('a project in an existing round is saved', () =>
    inRollback(async (tx) => {
      await makeRound(tx)
      const project = await makeProject(tx, p.alice.id)
      await tx`update projects set round = ${ROUND} where id = ${project.id}`
      const [row] = await tx`select round from projects where id = ${project.id}`
      expect(row.round).toBe(ROUND)
    }))
  test("a round that doesn't exist is refused", () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      await expect(
        (async () =>
          await tx`update projects set round = ${'No such round ' + RUN} where id = ${project.id}`)()
      ).rejects.toThrow('projects_round_fkey')
    }))
})
