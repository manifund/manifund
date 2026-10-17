// The things route and database tests use: projects made for one test file (route tests) or inside a rolled-back
// transaction (database tests), and deleted after, so tests never touch real projects. Who acts: people.ts.
import { sql, type Tx } from './db'
import { doc, RUN } from './content'
import { deleteTempUsers, person } from './people'
import type { Client } from './http'

export { getPeople, type People, type Persona } from './people'

// A project owned by `creator`, in `stage` (inside a transaction or committed).
export async function makeProject(db: Tx | typeof sql, creator: string, stage = 'active', slug = `${RUN}-p`) {
  const [row] = await db`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round, description)
    values (${'Test project ' + RUN}, 'test', ${creator}, ${slug}, ${stage}, 'grant', 100, 1000, 10000000, 'Regrants', ${doc('A test project.')})
    returning id, slug`
  return row as { id: string; slug: string }
}

// An org page (public.orgs) for this file, slug `<run>-<name>`.
export async function makeOrg(db: Tx | typeof sql, name: string, fields: Record<string, unknown> = {}) {
  const [row] = await db`
    insert into orgs ${sql({ slug: `${RUN}-${name}`, name: `Org ${name} ${RUN}`, ...fields })}
    returning id, slug, name`
  return row as { id: string; slug: string; name: string }
}

// Committed fixtures for one route test file (the server can't see a test's transaction): a project and a draft,
// both by the file's own creator.
export type World = {
  creator: Client
  project: { id: string; slug: string }
  draft: { id: string; slug: string }
}
let world: World | undefined
export async function getWorld(): Promise<World> {
  if (world) return world
  const creator = await person('creator')
  const project = await makeProject(sql, creator.id)
  const draft = await makeProject(sql, creator.id, 'draft', `${RUN}-draft`)
  world = { creator, project, draft }
  return world
}

// Delete everything this file created: its org pages, its projects (with their comments, which cascade to replies, revisions,
// reports and notifications), then its people and the rest of their rows.
export async function cleanWorld() {
  const made = await sql`select id from projects where slug like ${RUN + '%'} or title like ${'%' + RUN + '%'}`
  const ids = made.map((r: any) => r.id)
  if (ids.length) {
    await sql`delete from comments where project in ${sql(ids)}`
    await sql`delete from project_follows where project_id in ${sql(ids)}`
    await sql`delete from bids where project in ${sql(ids)}`
    await sql`delete from txns where project in ${sql(ids)}`
    await sql`delete from project_causes where project_id in ${sql(ids)}`
    await sql`delete from project_transfers where project_id in ${sql(ids)}`
    await sql`delete from projects where id in ${sql(ids)}`
  }
  // Org pages, with their reviews and project links (they cascade).
  await sql`delete from orgs where slug like ${RUN + '%'}`
  await deleteTempUsers()
  world = undefined
}
