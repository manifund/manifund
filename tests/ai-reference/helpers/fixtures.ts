// The things database tests use: projects made inside a rolled-back transaction, so tests never touch real
// projects. Who acts: people.ts.
import { sql, type Tx } from './db'
import { doc, RUN } from './content'

export { getPeople, type People, type Persona } from './people'

// A project owned by `creator`, in `stage` (inside a transaction or committed).
export async function makeProject(db: Tx | typeof sql, creator: string, stage = 'active', slug = `${RUN}-p`) {
  const [row] = await db`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round, description)
    values (${'Test project ' + RUN}, 'test', ${creator}, ${slug}, ${stage}, 'grant', 100, 1000, 10000000, 'Regrants', ${doc('A test project.')})
    returning id, slug`
  return row as { id: string; slug: string }
}
