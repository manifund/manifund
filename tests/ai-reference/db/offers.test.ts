// Offers and activation in the database (docs/ai-reference/offers/README.md): who can write offers, and what the
// activation and rejection functions do to offers and money. Each test runs in a rolled-back transaction, except
// B13 (two activations at once), which needs committed rows: it makes its own people and project and deletes them.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, sql, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { deleteTempUsers, tempUser } from '../helpers/people'
import { RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// Inserting a bid also queues the local webhook (a pg_net request); inside a rolled-back transaction the request
// is rolled back with it, so the dev server never hears of these offers.
async function offer(
  db: Tx | typeof sql,
  o: {
    project: string
    by: string
    amount: number
    type?: string
    status?: string
    valuation?: number
  }
): Promise<string> {
  const [row] = await db`
    insert into bids (project, bidder, amount, valuation, type, status)
    values (${o.project}, ${o.by}, ${o.amount}, ${o.valuation ?? 0}, ${o.type ?? 'donate'}, ${o.status ?? 'pending'})
    returning id`
  return row.id
}
async function proposal(
  db: Tx | typeof sql,
  creator: string,
  fields: Record<string, unknown> = {},
  slug?: string
) {
  const project = await makeProject(db, creator, 'proposal', slug)
  if (Object.keys(fields).length)
    await db`update projects set ${sql(fields)} where id = ${project.id}`
  return project
}
const statuses = async (tx: Tx, project: string) =>
  Object.fromEntries(
    (await tx`select id, status from bids where project = ${project}`).map((r: any) => [
      r.id,
      r.status,
    ])
  )

describe('B8 nobody writes an offer in someone else’s name; the bidder withdraws theirs', () => {
  test('nobody places an offer in someone else’s name', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await expect(
        (async () => await offer(tx, { project: project.id, by: p.rita.id, amount: 25 }))()
      ).rejects.toThrow('row-level security')
    }))
  test('the bidder withdraws their offer: it is marked deleted', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      const id = await offer(tx, { project: project.id, by: p.bob.id, amount: 25 })
      await actAs(tx, p.bob.id)
      const changed = await tx`update bids set status = 'deleted' where id = ${id} returning id`
      expect(changed).toHaveLength(1)
    }))
  test('nobody else can change it, signed in or not', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      const id = await offer(tx, { project: project.id, by: p.bob.id, amount: 25 })
      await actAs(tx, p.rita.id)
      expect(
        await tx`update bids set status = 'deleted' where id = ${id} returning id`
      ).toHaveLength(0)
      await actAsAnon(tx)
      expect(
        await tx`update bids set status = 'deleted' where id = ${id} returning id`
      ).toHaveLength(0)
      await tx`reset role`
      expect((await tx`select status from bids where id = ${id}`)[0].status).toBe('pending')
    }))
})

describe('B11 B12 activating a grant turns the checked donate offers into donations, in one step', () => {
  test('stage, offers and txns', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id, {
        min_funding: 100,
        funding_goal: 200,
        approved: true,
        signed_agreement: true,
      })
      const before = (await tx`select * from projects where id = ${project.id}`)[0]
      const a = await offer(tx, { project: project.id, by: p.bob.id, amount: 150 })
      const b = await offer(tx, { project: project.id, by: p.rita.id, amount: 100 }) // B12: 250 in all, past the goal
      const declined = await offer(tx, {
        project: project.id,
        by: p.bob.id,
        amount: 1000,
        status: 'declined',
      })
      const withdrawn = await offer(tx, {
        project: project.id,
        by: p.bob.id,
        amount: 1000,
        status: 'deleted',
      })
      const buy = await offer(tx, { project: project.id, by: p.rita.id, amount: 1000, type: 'buy' })

      const checked = [
        { id: a, amount: 150 },
        { id: b, amount: 100 },
      ]
      await tx`select activate_proposal(${project.id}, ${JSON.stringify(checked)}::text::jsonb)`

      const after = (await tx`select * from projects where id = ${project.id}`)[0]
      expect(after.stage).toBe('active')
      expect({ ...after, stage: before.stage }).toEqual(before) // nothing else on the project changes
      expect(await statuses(tx, project.id)).toEqual({
        [a]: 'accepted',
        [b]: 'accepted',
        [declined]: 'declined',
        [withdrawn]: 'deleted',
        [buy]: 'pending',
      })
      const txns =
        await tx`select from_id, to_id, amount::float as amount, token, type, project from txns
                            where project = ${project.id} order by amount desc`
      expect(txns).toEqual([
        {
          from_id: p.bob.id,
          to_id: p.alice.id,
          amount: 150,
          token: 'USD',
          type: 'project donation',
          project: project.id,
        },
        {
          from_id: p.rita.id,
          to_id: p.alice.id,
          amount: 100,
          token: 'USD',
          type: 'project donation',
          project: project.id,
        },
      ])
    }))
  test('an activation with nothing pending moves nothing', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      await offer(tx, { project: project.id, by: p.bob.id, amount: 150, status: 'accepted' })
      await tx`select activate_proposal(${project.id}, ${JSON.stringify([])}::text::jsonb)`
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
})

describe('B13 two activations at the same time pay each offer once', () => {
  // Committed rows: the second activation must see the offers the first one is converting. Bids committed here
  // reach the dev server's webhook (if the local database has one); the project is unapproved, so it only follows.
  let project: { id: string }
  let creator: string
  const donors: string[] = []
  const checked: { id: string; amount: number }[] = []
  beforeAll(async () => {
    creator = (await tempUser('offers-creator')).id
    donors.push((await tempUser('offers-donor1')).id, (await tempUser('offers-donor2')).id)
    project = await proposal(sql, creator, {}, `${RUN}-offers-race`)
    for (const d of donors)
      checked.push({ id: await offer(sql, { project: project.id, by: d, amount: 60 }), amount: 60 })
  })
  afterAll(async () => {
    await sql`delete from txns where project = ${project.id}`
    await sql`delete from bids where project = ${project.id}`
    await sql`delete from project_follows where project_id = ${project.id}`
    await sql`delete from projects where id = ${project.id}`
    await deleteTempUsers()
  })

  test('the second waits for the first, then finds the project already active and pays nothing', async () => {
    let releaseFirst!: () => void
    const firstMayCommit = new Promise<void>((r) => (releaseFirst = r))
    let firstDone!: () => void
    const firstHasActivated = new Promise<void>((r) => (firstDone = r))

    const first = sql.begin(async (tx: Tx) => {
      await tx`select activate_proposal(${project.id}, ${JSON.stringify(checked)}::text::jsonb)`
      firstDone()
      await firstMayCommit // hold the locks while the second one starts
    })
    await firstHasActivated
    const second = sql
      .begin(
        (tx: Tx) =>
          tx`select activate_proposal(${project.id}, ${JSON.stringify(checked)}::text::jsonb)`
      )
      .then(
        () => null,
        (e: Error) => e
      )
    // Wait until the second is blocked on the first's locks (or give up after 3 s and let the test check anyway).
    for (let i = 0; i < 30; i++) {
      const [w] = await sql`select count(*)::int as n from pg_stat_activity
                            where wait_event_type = 'Lock' and query ilike '%activate_proposal%'`
      if (w.n > 0) break
      await Bun.sleep(100)
    }
    releaseFirst()
    const [, secondError] = await Promise.all([first, second])
    expect(secondError?.message).toContain('is not a proposal')

    const txns =
      await sql`select from_id, amount::float as amount from txns where project = ${project.id}`
    expect(txns).toHaveLength(2)
    expect(txns.map((t: any) => t.from_id).sort()).toEqual([...donors].sort())
  })
})

describe('B14 only the server activates or declines offers (with the production grants)', () => {
  // Production revokes these functions from browsers (migration 20260911000000). A local database restored from a
  // dump may grant them again through default privileges, so apply the migration's revoke inside the transaction.
  const migration = readFileSync(
    join(import.meta.dir, '../../../supabase/migrations/20260911000000_secure_grant_rpcs.sql'),
    'utf8'
  )
  const revoke = migration.match(/do \$\$[\s\S]*?end \$\$;/i)?.[0]

  for (const fn of ['activate_grant', 'activate_cert', 'reject_proposal']) {
    test(`${fn}: refused to signed-in people and visitors`, () =>
      inRollback(async (tx) => {
        expect(revoke).toBeDefined()
        expect(revoke).toContain(`'${fn}'`)
        const project = await proposal(tx, p.alice.id)
        await tx.unsafe(revoke!)
        const call = fn === 'reject_proposal' ? `select ${fn}($1)` : `select ${fn}($1, $2)`
        const args = fn === 'reject_proposal' ? [project.id] : [project.id, p.alice.id]
        await tx`savepoint s`
        await actAs(tx, p.alice.id)
        await expect((async () => await tx.unsafe(call, args))()).rejects.toThrow(
          'permission denied'
        )
        await tx`rollback to savepoint s`
        await actAsAnon(tx)
        await expect((async () => await tx.unsafe(call, args))()).rejects.toThrow(
          'permission denied'
        )
      }))
  }
})

describe('B15 a proposal that is not funded declines its offers; no money moves', () => {
  test('reject_proposal declines every pending offer and sets the project to not funded', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      const a = await offer(tx, { project: project.id, by: p.bob.id, amount: 40 })
      const b = await offer(tx, { project: project.id, by: p.rita.id, amount: 10, type: 'buy' })
      const withdrawn = await offer(tx, {
        project: project.id,
        by: p.bob.id,
        amount: 5,
        status: 'deleted',
      })

      await tx`select reject_proposal(${project.id})`

      expect((await tx`select stage from projects where id = ${project.id}`)[0].stage).toBe(
        'not funded'
      )
      expect(await statuses(tx, project.id)).toEqual({
        [a]: 'declined',
        [b]: 'declined',
        [withdrawn]: 'deleted',
      })
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
  test("an admin's rejection does the same", () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      const a = await offer(tx, { project: project.id, by: p.bob.id, amount: 40 })
      await tx`select execute_grant_verdict_v2(false, ${project.id}, ${p.rita.id}, null)`
      const [row] = await tx`select stage, approved from projects where id = ${project.id}`
      expect(row).toEqual({ stage: 'not funded', approved: false })
      expect(await statuses(tx, project.id)).toEqual({ [a]: 'declined' })
      expect(await tx`select 1 from txns where project = ${project.id}`).toHaveLength(0)
    }))
})

describe('B19 activating a certificate trades each assurance buy for shares', () => {
  test('offers accepted, a USD txn and a shares txn per buyer, in one bundle', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id, { type: 'cert' })
      const sell = await offer(tx, {
        project: project.id,
        by: p.alice.id,
        amount: 100,
        type: 'assurance sell',
        valuation: 1000,
      })
      const buy = await offer(tx, {
        project: project.id,
        by: p.bob.id,
        amount: 100,
        type: 'assurance buy',
        valuation: 1000,
      })
      const donate = await offer(tx, { project: project.id, by: p.rita.id, amount: 7 })

      await tx`select activate_proposal(${project.id}, ${JSON.stringify([{ id: buy, amount: 100 }])}::text::jsonb)`

      expect((await tx`select stage from projects where id = ${project.id}`)[0].stage).toBe(
        'active'
      )
      expect(await statuses(tx, project.id)).toEqual({
        [sell]: 'accepted',
        [buy]: 'accepted',
        [donate]: 'pending',
      })
      const txns =
        await tx`select from_id, to_id, amount::float as amount, token, type, bundle from txns
                            where project = ${project.id} order by token = 'USD' desc`
      expect(txns).toHaveLength(2)
      const [usd, shares] = txns
      expect(usd).toMatchObject({
        from_id: p.bob.id,
        to_id: p.alice.id,
        amount: 100,
        token: 'USD',
        type: 'user to user trade',
      })
      // 100 / 1000 of 10,000,000 shares
      expect(shares).toMatchObject({
        from_id: p.alice.id,
        to_id: p.bob.id,
        amount: 1_000_000,
        token: project.id,
        type: 'user to user trade',
      })
      expect(usd.bundle).not.toBeNull()
      expect(usd.bundle).toBe(shares.bundle)
    }))
})

describe('B6 a repeat offer follows without failing', () => {
  // follow_project ignores an existing follow (#291).
  test('following a project twice does not fail', () =>
    inRollback(async (tx) => {
      const project = await proposal(tx, p.alice.id)
      await tx`select follow_project(${project.id}, ${p.bob.id})`
      await tx`select follow_project(${project.id}, ${p.bob.id})`
      expect(await tx`select 1 from project_follows where project_id = ${project.id}`).toHaveLength(
        1
      )
    }))
})
