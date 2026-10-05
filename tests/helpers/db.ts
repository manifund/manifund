// Direct database access for tests: Bun's built-in Postgres client, as the `postgres` superuser of
// the LOCAL database only (never point TEST_DB_URL at a remote database).
import { SQL } from 'bun'
import { env } from './env'

if (!/127\.0\.0\.1|localhost/.test(env.dbUrl)) {
  throw new Error(`tests only run against a local database, not ${env.dbUrl}`)
}

export const sql = new SQL(env.dbUrl)
export type Tx = SQL

class Rollback extends Error {}

// Run fn in a transaction that is always rolled back: nothing a test writes survives.
export async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T
  try {
    await sql.begin(async (tx: Tx) => {
      result = await fn(tx)
      throw new Rollback()
    })
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  }
  return result!
}

// Inside a transaction: act as a signed-in user (Supabase's `authenticated` role, auth.uid() = id),
// so row-level security applies. Lasts until the transaction ends.
export async function actAs(tx: Tx, userId: string) {
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`
  await tx`set local role authenticated`
}
export async function actAsAnon(tx: Tx) {
  await tx`reset role`
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`
  await tx`set local role anon`
}

// Insert a comment directly (as the database sees any writer). Returns its id.
export async function insertComment(
  tx: Tx,
  c: {
    by: string
    project?: string
    profile?: string
    text?: string
    replyingTo?: string
    type?: string
  }
): Promise<string> {
  const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: c.text ?? 'test' }] }] }
  const [row] = await tx`
    insert into comments (commenter, project, profile_id, content, replying_to, special_type)
    values (${c.by}, ${c.project ?? null}, ${c.profile ?? null}, ${content},
            ${c.replyingTo ?? null}, ${c.type ?? null})
    returning id`
  return row.id
}
