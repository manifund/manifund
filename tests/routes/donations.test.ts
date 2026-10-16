// Donations from a Manifund balance (/api/transfer-money): what the server accepts. bob donates to
// alice's projects (made for the run); rita is an admin in development. The balance bob gives from and
// every txn the tests write are deleted at the end.
import { afterAll, beforeAll, describe, expect } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, makeProject, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let bob: Client
let rita: Client
let alice: Client
const stages: Record<string, { id: string }> = {}
let start: Set<string>

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
  for (const stage of ['proposal', 'draft', 'hidden', 'complete', 'not funded']) {
    stages[stage] = await makeProject(
      sql,
      w.people.alice.id,
      stage,
      `${RUN}-donations-${stage.replace(' ', '-')}`
    )
  }
  start = await bobTxnIds()
  // Something for bob to give.
  await sql`insert into txns (from_id, to_id, amount, token, type)
            values (${w.people.rita.id}, ${w.people.bob.id}, 1000, 'USD', 'profile donation')`
})

afterAll(async () => {
  const made = [...(await bobTxnIds())].filter((id) => !start.has(id))
  if (made.length) await sql`delete from txns where id in ${sql(made)}`
})

// Bob's txns, by id: tests compare against a snapshot rather than the clock.
const bobTxnIds = async () =>
  new Set<string>(
    (
      await sql`select id from txns where from_id = ${w.people.bob.id} or to_id = ${w.people.bob.id}`
    ).map((r: { id: string }) => r.id)
  )
// Txns from bob not in the snapshot `before`, as plain objects.
const fromBobSince = async (before: Set<string>) =>
  Array.from(
    await sql`select id, to_id, amount::float as amount, type, project from txns
              where from_id = ${w.people.bob.id} order by created_at`
  )
    .filter((r: any) => !before.has(r.id))
    .map(({ id, ...rest }: any) => rest)

const donate = (who: Client, body: Record<string, unknown>) => who.post('/api/transfer-money', body)

describe('Donations from a balance', () => {
  smoke('a donation to an active project, to its creator, goes through', async () => {
    const t = await bobTxnIds()
    const r = await donate(bob, {
      fromId: bob.id,
      toId: alice.id,
      amount: 50,
      projectId: w.project.id,
    })
    expect(r.status).toBe(200)
    expect(await fromBobSince(t)).toMatchObject([
      { to_id: alice.id, amount: 50, type: 'project donation', project: w.project.id },
    ])
  })

  smoke('a donation to a profile (no project) goes through', async () => {
    const t = await bobTxnIds()
    const r = await donate(bob, { fromId: bob.id, toId: alice.id, amount: 20 })
    expect(r.status).toBe(200)
    expect(await fromBobSince(t)).toMatchObject([
      { to_id: alice.id, amount: 20, type: 'profile donation' },
    ])
  })

  standard("a project donation goes to the project's creator, not someone else", async () => {
    const t = await bobTxnIds()
    for (const toId of [bob.id, rita.id]) {
      const r = await donate(bob, { fromId: bob.id, toId, amount: 50, projectId: w.project.id })
      expect(r.status).toBe(400)
      expect(r.text).toBe('Recipient must be the project creator')
    }
    const missing = await donate(bob, {
      fromId: bob.id,
      toId: alice.id,
      amount: 50,
      projectId: '00000000-0000-4000-8000-000000000000',
    })
    expect(missing.status).toBe(400)
    expect(await fromBobSince(t)).toHaveLength(0)
  })

  standard('donations go to active projects only', async () => {
    const t = await bobTxnIds()
    for (const stage of Object.keys(stages)) {
      const r = await donate(bob, {
        fromId: bob.id,
        toId: alice.id,
        amount: 50,
        projectId: stages[stage].id,
      })
      expect([stage, r.status, r.text]).toEqual([
        stage,
        400,
        'This project is not accepting donations right now',
      ])
    }
    expect(await fromBobSince(t)).toHaveLength(0)
  })

  standard('the amount must be a positive number', async () => {
    const t = await bobTxnIds()
    for (const amount of [0, -5, '50', null, undefined]) {
      for (const projectId of [w.project.id, undefined]) {
        const r = await donate(bob, { fromId: bob.id, toId: alice.id, amount, projectId })
        expect([amount, projectId, r.status === 200]).toEqual([amount, projectId, false])
      }
    }
    expect(await fromBobSince(t)).toHaveLength(0)
  })

  standard("no one can give from someone else's balance", async () => {
    const t = await bobTxnIds()
    const r = await donate(alice, {
      fromId: bob.id,
      toId: alice.id,
      amount: 30,
      projectId: w.project.id,
    })
    expect(r.status).not.toBe(200)
    expect(await fromBobSince(t)).toHaveLength(0)
  })

  standard(
    "an admin's manual transfer may name any recipient and a project in any stage",
    async () => {
      const t = await bobTxnIds()
      // Each txn is written; following the project for the donor then fails under the admin's session
      // (row-level security), so the admin gets an error response though the transfer went through.
      await donate(rita, {
        fromId: bob.id,
        toId: alice.id,
        amount: 15,
        projectId: stages.complete.id,
      })
      await donate(rita, { fromId: bob.id, toId: rita.id, amount: 30, projectId: w.project.id })
      expect(await fromBobSince(t)).toMatchObject([
        { to_id: alice.id, amount: 15, project: stages.complete.id },
        { to_id: rita.id, amount: 30, project: w.project.id },
      ])
    }
  )
})
