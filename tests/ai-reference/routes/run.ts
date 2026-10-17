// Runs the ai-reference route tests: `bun run test:ai-reference:routes [file or folder ...]`.
// 1. Once per run: the personas' profiles (fixtures/personas.sql) and a warm-up of every page and API route the
//    tests use, all at once (the dev server compiles each on its first visit).
// 2. The files run side by side (TEST_PARALLEL files at a time, default 3): each file uses its own people.
// 3. Checks the shared test accounts' rows are as before: a test that changed them should use its own people.
// Settings: TEST_LEVEL (smoke | standard | full), TEST_PARALLEL, TEST_WARM=0 to skip the warm-up.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { requireServer } from '../helpers/http'
import { applyPersonas, getPeople } from '../helpers/people'

const root = join(import.meta.dir, '..', '..', '..')
const here = import.meta.dir
const parallel = Number(process.env.TEST_PARALLEL ?? 3)

const testFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? testFiles(p) : p.endsWith('.test.ts') ? [p] : []
  })

const all = testFiles(here)

// Which files to run: all, or those under the paths given.
const wanted = process.argv.slice(2).map((p) => resolve(process.cwd(), p))
const chosen = wanted.length
  ? all.filter((f) => wanted.some((w) => f === w || f.startsWith(w + '/')))
  : all
if (!chosen.length) {
  console.error(`No route tests under ${process.argv.slice(2).join(' ')}`)
  process.exit(1)
}

// 1. Once per run.
await requireServer()
await applyPersonas()
const WARM = {
  GET: [
    '/',
    '/projects',
    '/causes',
    '/people',
    '/about/regranting-data',
    '/donor-survey',
    '/docs',
    '/projects?tab=comments',
    '/alice',
    '/alice?tab=by',
    '/notifications',
    '/admin/users',
    '/admin/transactions',
    '/admin/approvals',
    '/admin/projects',
    '/admin/tools',
    '/admin/comment-reports',
    '/api/v0/comments',
    '/people/id/00000000-0000-0000-0000-000000000000',
    '/projects/persona-bob-notebooks?tab=comments',
    '/orgs/no-such-org',
  ],
  POST: [
    '/api/comments',
    '/api/comments/00000000-0000-0000-0000-000000000000/react',
    '/api/comments/00000000-0000-0000-0000-000000000000/report',
    '/api/comments/00000000-0000-0000-0000-000000000000/resolve',
    '/api/close-active-project',
    '/api/issue-grant-verdict',
    '/api/create-grant',
    '/api/notifications/read',
  ],
  PATCH: ['/api/comments/00000000-0000-0000-0000-000000000000'],
}
if (process.env.TEST_WARM !== '0') {
  const t = Date.now()
  await Promise.all(
    Object.entries(WARM).flatMap(([method, paths]) =>
      paths.map(
        (p) =>
          fetch(`${env.baseUrl}${p}`, {
            method,
            redirect: 'manual',
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' ? undefined : '{}',
            signal: AbortSignal.timeout(240_000),
          })
            .then((r) => r.arrayBuffer())
            .catch(() => {}) // a slow or failing page shows up in its test
      )
    )
  )
  console.log(`warm-up: ${((Date.now() - t) / 1000).toFixed(1)} s`)
}

// The shared accounts' rows, table by table (ids and what tests could change).
async function fingerprint() {
  const ids = Object.values(await getPeople()).map((p) => p.id)
  const [row] = await sql`
    select
      (select md5(coalesce(string_agg(p::text, '|' order by p.id), '')) from profiles p where p.id in ${sql(ids)}) as profiles,
      (select md5(coalesce(string_agg(t.id::text, '|' order by t.id), '')) from txns t
        where t.from_id in ${sql(ids)} or t.to_id in ${sql(ids)}) as txns,
      (select md5(coalesce(string_agg(c.id || coalesce(c.edited_at::text, '') || coalesce(c.deleted_at::text, ''),
        '|' order by c.id), '')) from comments c
        where c.commenter in ${sql(ids)} or c.profile_id in ${sql(ids)}
           or c.project in (select id from projects where creator in ${sql(ids)})) as comments,
      (select md5(coalesce(string_agg(n.id || coalesce(n.read_at::text, ''), '|' order by n.id), ''))
        from notifications n where n.recipient_id in ${sql(ids)}) as notifications,
      (select md5(coalesce(string_agg(r.id || coalesce(r.resolved_at::text, ''), '|' order by r.id), ''))
        from comment_reports r where r.reporter_id in ${sql(ids)}) as reports,
      (select md5(coalesce(string_agg(x.comment_id || x.reaction, '|' order by x.comment_id, x.reaction), ''))
        from comment_rxns x where x.reactor_id in ${sql(ids)}) as reactions,
      (select md5(coalesce(string_agg(f.project_id::text, '|' order by f.project_id), ''))
        from project_follows f where f.follower_id in ${sql(ids)}) as follows,
      (select md5(coalesce(string_agg(j.id::text || j.stage::text, '|' order by j.id), '')) from projects j
        where j.creator in ${sql(ids)}) as projects`
  return row as Record<string, string>
}
const before = await fingerprint()

// 2. The files.
const bunTest = (files: string[], extra: string[]) =>
  Bun.spawn(
    // --isolate: each file gets its own copy of the helpers (its own run marker, people and projects), also when
    // files run one after another in one process.
    [
      'bun',
      'test',
      '--conditions',
      'react-server',
      '--preload',
      './tests/ai-reference/routes/setup.ts',
      '--timeout',
      '60000',
      '--isolate',
      ...extra,
      ...files.map((f) => relative(root, f)),
    ],
    { cwd: root, stdout: 'inherit', stderr: 'inherit', env: process.env }
  ).exited
console.log(`${chosen.length} files, ${Math.min(parallel, chosen.length)} at a time`)
let failed =
  (await bunTest(chosen, parallel > 1 && chosen.length > 1 ? [`--parallel=${parallel}`] : [])) !== 0

// 3. Nothing shared changed.
const after = await fingerprint()
const changed = Object.keys(before).filter((k) => before[k] !== after[k])
if (changed.length) {
  console.error(
    `The shared test accounts' ${changed.join(', ')} changed during the run. A test that changes them should use ` +
      `its own people (person('…')). (Or someone else used alice, bob or rita ` +
      `at the same time.)`
  )
  failed = true
}
await sql.end()
process.exit(failed ? 1 : 0)
