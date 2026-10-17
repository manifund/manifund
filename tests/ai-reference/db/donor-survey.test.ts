// The donor survey's rules the database keeps (docs/ai-reference/donor-survey/README.md), checked as visitors and
// signed-in people. Only throwaway profiles and responses made inside the test's transaction, always rolled back:
// real answers are personal data and are never read here.
import { describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'

const tag = () => `ds${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
async function makeProfile(tx: Tx) {
  const id = crypto.randomUUID()
  await tx`insert into profiles (id, username, full_name) values (${id}, ${tag()}, 'Test donor')`
  return id
}
async function makeResponse(
  tx: Tx,
  fields: { profile?: string | null; email?: string; funds?: number | null } = {}
) {
  const [row] = await tx`
    insert into donor_survey_responses (profile_id, full_name, email, capacity, giving_2026, giving_2027, funds_vs_direct)
    values (${fields.profile ?? null}, 'Test donor', ${fields.email ?? `${tag()}@example.test`}, '{own_money}',
            'under_50k', 'not_sure', ${fields.funds ?? null})
    returning id`
  return row.id as string
}
// Bun's tagged queries are lazy: they run only once awaited, and expect(...).rejects doesn't start them (the query
// would then wait in the transaction and block its rollback). Start it inside an async function.
const run = (query: PromiseLike<unknown>) => (async () => await query)()

describe('D3 funds vs. picking charities: a whole percentage in steps of 5', () => {
  test('0, 35 and 100 are kept', () =>
    inRollback(async (tx) => {
      for (const funds of [0, 35, 100]) await makeResponse(tx, { funds })
    }))
  for (const funds of [37, 105, -5])
    test(`${funds} is refused`, () =>
      inRollback(async (tx) => {
        await expect(makeResponse(tx, { funds })).rejects.toThrow(/funds_vs_direct_check/)
      }))
})

describe('D5 one response per account and per email', () => {
  test('a second response for the same account is refused', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await makeResponse(tx, { profile: ann })
      await expect(makeResponse(tx, { profile: ann })).rejects.toThrow(/profile_id_idx|duplicate/)
    }))
  test('a second response under the same email, in another case, is refused', () =>
    inRollback(async (tx) => {
      const email = `${tag()}@example.test`
      await makeResponse(tx, { email })
      await expect(makeResponse(tx, { email: email.toUpperCase() })).rejects.toThrow(
        /email_idx|duplicate/
      )
    }))
  test('responses without an account, under different emails, are fine', () =>
    inRollback(async (tx) => {
      await makeResponse(tx)
      await makeResponse(tx)
    }))
})

describe('D21 browsers write no responses and read only their own', () => {
  test('the donor reads their own response; another signed-in person and visitors read none', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const bob = await makeProfile(tx)
      const id = await makeResponse(tx, { profile: ann })
      await tx`update donor_survey_responses set is_public = true where id = ${id}` // even published ones
      await actAs(tx, ann)
      expect(await tx`select id from donor_survey_responses where id = ${id}`).toHaveLength(1)
      await tx`reset role`
      await actAs(tx, bob)
      expect(await tx`select id from donor_survey_responses where id = ${id}`).toHaveLength(0)
      await actAsAnon(tx)
      expect(await tx`select id from donor_survey_responses where id = ${id}`).toHaveLength(0)
    }))
  test('a response without an account is readable by no browser', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const id = await makeResponse(tx)
      await actAs(tx, ann)
      expect(await tx`select id from donor_survey_responses where id = ${id}`).toHaveLength(0)
    }))
  test('the donor adds, changes and deletes nothing through the database API', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const id = await makeResponse(tx, { profile: ann })
      await actAs(tx, ann)
      expect(
        await tx`update donor_survey_responses set is_public = true where id = ${id} returning id`
      ).toHaveLength(0)
      expect(
        await tx`delete from donor_survey_responses where id = ${id} returning id`
      ).toHaveLength(0)
      await expect(
        run(
          tx`insert into donor_survey_responses (profile_id, full_name, email) values (${ann}, 'x', ${`${tag()}@example.test`})`
        )
      ).rejects.toThrow('row-level security')
    }))
  test('visitors add nothing', () =>
    inRollback(async (tx) => {
      await actAsAnon(tx)
      await expect(
        run(
          tx`insert into donor_survey_responses (full_name, email) values ('x', ${`${tag()}@example.test`})`
        )
      ).rejects.toThrow('row-level security')
    }))
  test("the MCP server's read-only SQL reads none", () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const id = await makeResponse(tx, { profile: ann })
      // As the server calls it: through the API with the service role, no signed-in person. Production lets the
      // service role switch to mcp_readonly (migration 20260703000000); the local copy lacks that grant, so it's
      // given here, inside the rolled-back transaction.
      await tx`grant mcp_readonly to service_role`
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'service_role' })}, true)`
      await tx`set local role service_role`
      const [{ rows }] =
        await tx`select execute_readonly_sql(${`select id from donor_survey_responses where id = '${id}'`}, 10) as rows`
      expect(rows).toEqual([])
      // while it does read other tables, e.g. the donor's profile (the function's role switch lasts until the
      // transaction ends, so switch back first)
      await tx`reset role`
      await tx`set local role service_role`
      const [{ rows: profiles }] =
        await tx`select execute_readonly_sql(${`select id from profiles where id = '${ann}'`}, 10) as rows`
      expect(profiles).toEqual([{ id: ann }])
    }))
})

describe('D22 deleting a profile keeps its response, unlinked', () => {
  test('profile_id becomes empty', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const id = await makeResponse(tx, { profile: ann })
      await tx`delete from profiles where id = ${ann}`
      expect(
        (await tx`select profile_id from donor_survey_responses where id = ${id}`) as unknown[]
      ).toEqual([{ profile_id: null }])
    }))
})
