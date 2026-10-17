// The database side of the public API and MCP servers (docs/ai-reference/api/README.md): the read-only SQL function behind
// the admin `query_sql` tool, and the two search functions. Only throwaway profiles, projects and embeddings made
// inside the test's transaction, always rolled back.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { makeProject } from '../helpers/fixtures'

// Bun's tagged queries are lazy: they run only once awaited, and expect(...).rejects doesn't start them (the query
// would then wait in the transaction and block its rollback). Start it inside an async function.
const run = (query: PromiseLike<unknown>) => (async () => await query)()

const tag = () => `api${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
async function makeProfile(tx: Tx) {
  const id = crypto.randomUUID()
  const username = tag()
  await tx`insert into profiles (id, username, full_name) values (${id}, ${username}, ${'Test ' + username})`
  return { id, username }
}

// The read-only SQL function as production has it. The local database is built from production's schema dump,
// which leaves out role memberships (`grant mcp_readonly to service_role`): apply the migration's grants inside the
// rolled-back transaction.
const migration = readFileSync(
  join(import.meta.dir, '../../../supabase/migrations/20260703000000_add_mcp_support.sql'),
  'utf8'
)
const grants = [
  ...(migration.match(/^grant mcp_readonly to service_role;$/m) ?? []),
  ...(migration.match(
    /^revoke execute on function execute_readonly_sql\(text, int\) from \w+;$/gm
  ) ?? []),
]
async function productionGrants(tx: Tx) {
  expect(grants).toHaveLength(4) // the membership, and the revokes from public, anon, authenticated
  for (const g of grants) await tx.unsafe(g)
}
async function readonlySql(tx: Tx, query: string, maxRows = 500) {
  await tx`set local role service_role`
  const [row] = await tx`select execute_readonly_sql(${query}, ${maxRows}) as r`
  await tx`reset role`
  return row.r as any[]
}

describe('I23 read-only SQL: one statement, read-only role, 15 seconds, at most 1,000 rows', () => {
  test('runs as the read-only role, with a 15-second timeout', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      const q = "select current_user as who, current_setting('statement_timeout') as timeout"
      expect(await readonlySql(tx, q)).toEqual([{ who: 'mcp_readonly', timeout: '15s' }])
    }))
  test('rows are capped at 1,000, and at least 1', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      expect(await readonlySql(tx, 'select generate_series(1, 2000) as n', 5000)).toHaveLength(1000)
      expect(await readonlySql(tx, 'select generate_series(1, 2000) as n', 3)).toHaveLength(3)
      expect(await readonlySql(tx, 'select generate_series(1, 2000) as n', 0)).toHaveLength(1)
    }))
  test('it reads public tables', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      const me = await makeProfile(tx)
      expect(await readonlySql(tx, `select username from profiles where id = '${me.id}'`)).toEqual([
        { username: me.username },
      ])
    }))
  test('the role has no write rights on any public table', () =>
    inRollback(async (tx) => {
      const writable = await tx`
        select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
          and (has_table_privilege('mcp_readonly', c.oid, 'INSERT')
            or has_table_privilege('mcp_readonly', c.oid, 'UPDATE')
            or has_table_privilege('mcp_readonly', c.oid, 'DELETE'))`
      expect(writable).toEqual([])
    }))
  test('a write through a function is refused', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      await tx.unsafe(`create function pg_temp.api_test_write() returns int language sql as
        $$ insert into causes (slug, title) values ('api-test-write', 'x') returning 1 $$`)
      await expect(run(readonlySql(tx, 'select pg_temp.api_test_write()'))).rejects.toThrow(
        /permission denied for table causes/
      )
    }))
  test('other schemas (sign-in data) are out of reach', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      await expect(run(readonlySql(tx, 'select count(*) from auth.users'))).rejects.toThrow(
        /permission denied for schema auth/
      )
    }))
  test('two statements are refused', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      await expect(run(readonlySql(tx, 'select 1; select 2'))).rejects.toThrow(/syntax/)
    }))
})

describe('I24 only the service role runs read-only SQL', () => {
  test('visitors are refused', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      await actAsAnon(tx)
      await expect(run(tx`select execute_readonly_sql('select 1', 1)`)).rejects.toThrow(
        /permission denied for function/
      )
    }))
  test('signed-in people are refused', () =>
    inRollback(async (tx) => {
      await productionGrants(tx)
      const me = await makeProfile(tx)
      await actAs(tx, me.id)
      await expect(run(tx`select execute_readonly_sql('select 1', 1)`)).rejects.toThrow(
        /permission denied for function/
      )
    }))
})

// A unit vector along one dimension: closer to itself than any real project's embedding is.
const DIM = 3072
const axis = (i: number) =>
  `[${Array.from({ length: DIM }, (_, k) => (k === i ? 1 : 0)).join(',')}]`
async function embed(tx: Tx, projectId: string, vector: string, model = 'text-embedding-3-large') {
  await tx`insert into project_embeddings (project_id, embedding, model_name) values (${projectId}, ${vector}::vector, ${model})`
}
// Throwaway projects in each stage, all with the same embedding.
async function projectsAlong(tx: Tx, vector: string, stages: string[]) {
  const creator = await makeProfile(tx)
  const out: Record<string, string> = {}
  for (const stage of stages) {
    const p = await makeProject(tx, creator.id, stage, `${creator.username}-${stage}`)
    await embed(tx, p.id, vector)
    out[stage] = p.id
  }
  return out
}

describe('I25 searching by meaning leaves out hidden and drafts unless asked, at most 50', () => {
  test('hidden and draft projects are left out by default', () =>
    inRollback(async (tx) => {
      const v = axis(11)
      const p = await projectsAlong(tx, v, ['active', 'proposal', 'hidden', 'draft'])
      const rows =
        await tx`select id, stage, similarity from search_projects_by_embedding(${v}::vector, 10)`
      const ids = rows.map((r: any) => r.id)
      expect(ids).toContain(p.active)
      expect(ids).toContain(p.proposal)
      expect(ids).not.toContain(p.hidden)
      expect(ids).not.toContain(p.draft)
      expect(rows.every((r: any) => !['hidden', 'draft'].includes(r.stage))).toBe(true)
    }))
  test('asked to include them (the admin tier), they come back', () =>
    inRollback(async (tx) => {
      const v = axis(12)
      const p = await projectsAlong(tx, v, ['hidden', 'draft'])
      const rows = await tx`select id from search_projects_by_embedding(${v}::vector, 10, true)`
      expect(rows.map((r: any) => r.id)).toEqual(expect.arrayContaining([p.hidden, p.draft]))
    }))
  test('closest first, and never more than 50', () =>
    inRollback(async (tx) => {
      const v = axis(13)
      const p = await projectsAlong(tx, v, ['active'])
      const rows =
        await tx`select id, similarity from search_projects_by_embedding(${v}::vector, 500)`
      expect(rows.length).toBeLessThanOrEqual(50)
      expect(rows[0].id).toBe(p.active)
      const sims = rows.map((r: any) => r.similarity)
      expect(sims).toEqual([...sims].sort((a, b) => b - a))
    }))
})

describe('I26 similar projects: the closest by meaning among embeddings of the same model, other than the project itself', () => {
  test('the closest projects of the same model, other than the project itself', () =>
    inRollback(async (tx) => {
      const v = axis(21)
      const p = await projectsAlong(tx, v, ['active', 'proposal', 'hidden'])
      const creator = await makeProfile(tx)
      const other = await makeProject(tx, creator.id, 'active', `${creator.username}-other-model`)
      await embed(tx, other.id, v, 'another-model')
      const rows = await tx`select id from find_similar_projects(${p.active}::uuid, 50)`
      const ids = rows.map((r: any) => r.id)
      expect(ids[0]).toBe(p.proposal)
      expect(ids).not.toContain(p.active)
      expect(ids).not.toContain(p.hidden)
      expect(ids).not.toContain(other.id)
    }))
})

describe('I8 users can be filtered by part of their id', () => {
  test('the id as text, readable by visitors (what `?id=` filters on)', () =>
    inRollback(async (tx) => {
      const me = await makeProfile(tx)
      await actAsAnon(tx)
      const part = me.id.slice(9, 18).toUpperCase()
      const rows = await tx`select id from profiles p where id_text(p) ilike ${'%' + part + '%'}`
      expect(rows.map((r: any) => r.id)).toEqual([me.id])
    }))
})
