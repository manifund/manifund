// The people and things tests use. People: the local stack's fictional test accounts (alice, bob,
// rita; rita is an admin in development). Things: projects created for the run and deleted after
// it, so tests never touch real projects.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql, type Tx } from './db'
import { doc, RUN } from './content'

export type Persona = 'alice' | 'bob' | 'rita'
export type People = Record<Persona, { id: string; email: string; username: string }>

let people: People | undefined
export async function getPeople(): Promise<People> {
  if (people) return people
  const rows = await sql`select p.id, u.email, p.username from profiles p join auth.users u on u.id = p.id
                         where u.email in ('alice@local.test', 'bob@local.test', 'rita@local.test')`
  const byName = Object.fromEntries(rows.map((r: any) => [r.username, r])) as People
  for (const name of ['alice', 'bob', 'rita'] as const) {
    if (!byName[name]) throw new Error(`test account ${name}@local.test is missing: run local-dev/reset.sh`)
  }
  // Give them full profiles (bio, About, a project, donations), so pages look like real ones.
  await sql.unsafe(readFileSync(join(import.meta.dir, '..', 'fixtures', 'personas.sql'), 'utf8'))
  people = byName
  return people
}

// A project owned by `creator`, in `stage` (inside a transaction or committed).
export async function makeProject(db: Tx | typeof sql, creator: string, stage = 'active', slug = `${RUN}-p`) {
  const [row] = await db`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round, description)
    values (${'Test project ' + RUN}, 'test', ${creator}, ${slug}, ${stage}, 'grant', 100, 1000, 10000000, 'Regrants', ${doc('A test project.')})
    returning id, slug`
  return row as { id: string; slug: string }
}

// Committed fixtures for route tests (the server can't see a test's transaction).
export type World = {
  people: People
  project: { id: string; slug: string }
  draft: { id: string; slug: string }
}
let world: World | undefined
export async function getWorld(): Promise<World> {
  if (world) return world
  const p = await getPeople()
  const project = await makeProject(sql, p.alice.id)
  const draft = await makeProject(sql, p.alice.id, 'draft', `${RUN}-draft`)
  world = { people: p, project, draft }
  return world
}

// Delete everything this run created (comments cascade to replies, revisions, reports,
// notifications). Profile comments are found by the run marker in their text.
export async function cleanWorld() {
  if (!world) return
  const { project, draft, people: p } = world
  // Projects made during the run (grants, closing), found by the run marker in their title or slug.
  const made = await sql`select id from projects where slug like ${RUN + '%'} or title like ${'%' + RUN + '%'}`
  const ids = [project.id, draft.id, ...made.map((r: any) => r.id)]
  await sql`delete from comments where project in ${sql(ids)}`
  await sql`delete from comments where profile_id in (${p.alice.id}, ${p.bob.id}, ${p.rita.id})
            and content::text like ${'%' + RUN + '%'}`
  await sql`delete from project_follows where project_id in ${sql(ids)}`
  await sql`delete from bids where project in ${sql(ids)}`
  await sql`delete from project_causes where project_id in ${sql(ids)}`
  await sql`delete from project_transfers where project_id in ${sql(ids)}`
  await sql`delete from projects where id in ${sql(ids)}`
  world = undefined
}
