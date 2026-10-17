// The public API and MCP servers (docs/ai-reference/api/README.md), against the dev server, with this file's own people,
// projects, txns and comments (committed, deleted at the end of the file).
// The admin MCP server (I22) is called in-process instead, pointed at the local database: the dev server has no
// MCP_ADMIN_TOKEN, and no admin token is ever written in a file (the in-process one is random, made here).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { anonymous, type Client } from '../helpers/http'
import { person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

type P = { id: string; slug: string }
let creator: Client, donor: Client, trader: Client, trader2: Client, commenter: Client
let active: P, proposal: P, hidden: P, draft: P, dummy: P
let causeSlug: string
const comments: string[] = [] // on `active`, oldest first
let replyId: string
let depositId: string
let onDraft: string
const FUTURE = encodeURIComponent(new Date(Date.now() + 3_600_000).toISOString())

async function txn(t: {
  from?: string | null
  to: string
  amount: number
  type: string
  project?: string
  token?: string
}) {
  const [row] = await sql`insert into txns (from_id, to_id, amount, token, type, project)
    values (${t.from ?? null}, ${t.to}, ${t.amount}, ${t.token ?? 'USD'}, ${t.type}, ${t.project ?? null}) returning id`
  return row.id as string
}
async function comment(by: string, target: { project: string }, text: string, replyingTo?: string) {
  const [row] = await sql`insert into comments (commenter, project, content, replying_to)
    values (${by}, ${target.project}, ${doc(text)}, ${replyingTo ?? null}) returning id`
  return row.id as string
}

// One JSON-RPC call to an MCP server; the answer is a server-sent event (`data: {...}`).
async function rpc(
  url: string,
  method: string,
  params: object,
  fetcher: (r: Request) => Promise<Response> = fetch
) {
  const res = await fetcher(
    new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  )
  const text = await res.text()
  const line = text.split('\n').find((l) => l.startsWith('data: '))
  return { status: res.status, body: line ? JSON.parse(line.slice(6)) : text }
}
// A tool's answer: { error } when it returned an error result, else its JSON.
async function tool(
  name: string,
  args: object = {},
  url = `${env.baseUrl}/api/mcp`,
  fetcher?: (r: Request) => Promise<Response>
) {
  const { status, body } = await rpc(url, 'tools/call', { name, arguments: args }, fetcher)
  expect(status).toBe(200)
  const text = body.result.content[0].text as string
  return body.result.isError ? { error: text } : JSON.parse(text)
}

beforeAll(async () => {
  ;[creator, donor, trader, trader2, commenter] = await Promise.all(
    ['creator', 'donor', 'trader', 'trader2', 'commenter'].map((n) => person(n))
  )
  active = await makeProject(sql, creator.id, 'active', `${RUN}-active`)
  proposal = await makeProject(sql, creator.id, 'proposal', `${RUN}-proposal`)
  hidden = await makeProject(sql, creator.id, 'hidden', `${RUN}-hidden`)
  draft = await makeProject(sql, creator.id, 'draft', `${RUN}-draft`)
  dummy = await makeProject(sql, creator.id, 'active', `${RUN}-dummy`)
  await sql`update projects set type = 'dummy' where id = ${dummy.id}`
  ;[{ slug: causeSlug }] = await sql`select slug from causes order by sort limit 1`
  await sql`insert into project_causes (project_id, cause_slug) values (${proposal.id}, ${causeSlug})`

  // Money: the donor deposits 100, gives 30 to `active`, offers 20 on `proposal` (below its minimum of 100).
  depositId = await txn({ to: donor.id, amount: 100, type: 'deposit' })
  await txn({
    from: donor.id,
    to: creator.id,
    amount: 30,
    type: 'project donation',
    project: active.id,
  })
  await sql`insert into bids (project, bidder, amount, valuation, type, status)
            values (${proposal.id}, ${donor.id}, 20, 0, 'donate', 'pending'),
                   (${proposal.id}, ${donor.id}, 7, 0, 'donate', 'declined')`
  // Share txns: a USD trade between two traders on `active`, and shares (not USD) minted to the creator.
  await txn({
    from: trader.id,
    to: trader2.id,
    amount: 5,
    type: 'user to user trade',
    project: active.id,
  })
  await txn({
    to: creator.id,
    amount: 1000,
    type: 'mint cert',
    project: active.id,
    token: active.id,
  })

  for (let i = 1; i <= 6; i++)
    comments.push(await comment(commenter.id, { project: active.id }, `comment ${i} ${RUN}`))
  replyId = await comment(creator.id, { project: active.id }, `a reply ${RUN}`, comments[0])
  onDraft = await comment(commenter.id, { project: draft.id }, `on draft ${RUN}`)
})

const get = (path: string) => anonymous().get(path)
const isIso = (s: string) => new Date(s).toISOString() === s

describe('I1 open to anyone, read-only', () => {
  smoke('each endpoint answers a visitor with JSON', async () => {
    for (const path of ['/api/v0/projects', '/api/v0/comments', '/api/v0/users']) {
      const r = await get(path)
      expect(r.status).toBe(200)
      expect(Array.isArray(r.body)).toBe(true)
    }
  })
  standard('they take no writes', async () => {
    for (const path of ['/api/v0/projects', '/api/v0/comments', '/api/v0/users'])
      expect((await anonymous().post(path, {})).status).toBe(405)
  })
  smoke('the public MCP server answers a visitor', async () => {
    const r = await rpc(`${env.baseUrl}/api/mcp`, 'tools/list', {})
    expect(r.status).toBe(200)
    expect(r.body.result.tools.length).toBe(9)
  })
})

describe('I3 at most 100 rows, newest first, `before` for the next page, ISO dates', () => {
  for (const path of ['/api/v0/projects', '/api/v0/comments', '/api/v0/users']) {
    standard(path, async () => {
      const first = await get(path)
      expect(first.body.length).toBeLessThanOrEqual(100)
      expect(first.body.length).toBeGreaterThan(0)
      const times = first.body.map((r: any) => r.created_at)
      expect(times.every(isIso)).toBe(true)
      expect([...times].sort().reverse()).toEqual(times)
      const last = times[times.length - 1]
      const next = await get(`${path}?before=${encodeURIComponent(last)}`)
      expect(next.body.length).toBeGreaterThan(0)
      expect(next.body.every((r: any) => r.created_at < last)).toBe(true)
    })
  }
  // Open question (docs/ai-reference/api/README.md, "A `before` that isn't a date"): today a server error (500).
  test.skip('a `before` that is not a date is refused as a bad request', async () => {
    expect((await get('/api/v0/projects?before=not-a-date')).status).toBe(400)
  })
})

describe('I4 /api/v0/projects', () => {
  smoke('leaves out hidden and draft projects', async () => {
    const slugs = (await get(`/api/v0/projects?before=${FUTURE}`)).body.map((p: any) => p.slug)
    expect(slugs).toContain(active.slug)
    expect(slugs).toContain(proposal.slug)
    expect(slugs).not.toContain(hidden.slug)
    expect(slugs).not.toContain(draft.slug)
  })
  standard('Markdown description, creator, causes, USD txns, pending offers', async () => {
    const all = (await get(`/api/v0/projects?before=${FUTURE}`)).body
    const a = all.find((p: any) => p.slug === active.slug)
    expect(a.description.trim()).toBe('A test project.')
    expect(a.profiles).toEqual({ username: creator.username, full_name: 'Test creator' })
    expect(a.txns.every((t: any) => t.token === 'USD')).toBe(true)
    expect(a.txns.map((t: any) => t.amount).sort((x: number, y: number) => x - y)).toEqual([5, 30])
    const p = all.find((x: any) => x.slug === proposal.slug)
    expect(p.bids).toEqual([{ amount: 20, status: 'pending' }])
    expect(p.causes.map((c: any) => c.slug)).toEqual([causeSlug])
  })
})

describe('I5 /api/v0/comments', () => {
  smoke('comments with their author and Markdown content', async () => {
    const all = (await get(`/api/v0/comments?before=${FUTURE}`)).body
    const c = all.find((x: any) => x.id === comments[5])
    expect(c.content.trim()).toBe(`comment 6 ${RUN}`)
    expect(c.profiles).toEqual({ username: commenter.username, full_name: 'Test commenter' })
    expect(c.project).toBe(active.id)
    expect(c.projects).toEqual({ title: `Test project ${RUN}`, slug: active.slug })
    expect(all.find((x: any) => x.id === replyId).replying_to).toBe(comments[0])
  })
})

const users = async (query: string) => (await get(`/api/v0/users?${query}`)).body as any[]

describe('I6 I7 /api/v0/users: public fields, balances, USD txns', () => {
  smoke('I6 only public profile fields', async () => {
    const [u] = await users(`username=${donor.username}`)
    expect(Object.keys(u).sort()).toEqual(
      [
        'avatar_url',
        'bio',
        'cash_balance',
        'charity_balance',
        'created_at',
        'full_name',
        'id',
        'regranter_status',
        'total_balance',
        'txns',
        'type',
        'username',
        'website',
      ].sort()
    )
  })
  standard('I7 balances as a profile shows them, and every USD txn newest first', async () => {
    const [d] = await users(`username=${donor.username}`)
    // 100 deposited, 30 donated; 20 offered on a proposal (locked, not spent).
    expect(d.total_balance).toBe(70)
    expect(d.charity_balance).toBe(50)
    expect(d.cash_balance).toBe(0)
    expect(d.txns).toHaveLength(2)
    const times = d.txns.map((t: any) => t.created_at)
    expect([...times].sort().reverse()).toEqual(times)
    expect(d.txns.at(-1)).toMatchObject({
      id: depositId,
      amount: 100,
      type: 'deposit',
      from_id: null,
      to_id: donor.id,
    })
    const [c] = await users(`username=${creator.username}`)
    expect(c.txns.every((t: any) => t.type !== 'mint cert')).toBe(true) // shares aren't USD
    expect(c.cash_balance).toBe(30)
  })
})

describe('I8 filters: id, username, name; any case; all must match; % and _ literal', () => {
  standard('substring, any case', async () => {
    expect((await users(`username=${RUN.toUpperCase()}-DON`)).map((u) => u.id)).toEqual([donor.id])
    expect((await users(`name=test%20DONOR&username=${RUN}`)).map((u) => u.id)).toEqual([donor.id])
    expect((await users(`id=${donor.id.slice(9, 23).toUpperCase()}`)).map((u) => u.id)).toEqual([
      donor.id,
    ])
  })
  standard('every filter must match, `before` too', async () => {
    expect(await users(`username=${RUN}-donor&name=trader`)).toEqual([])
    const [d] = await users(`username=${RUN}-donor`)
    expect(await users(`username=${RUN}-donor&before=${encodeURIComponent(d.created_at)}`)).toEqual(
      []
    )
  })
  standard('% and _ match themselves', async () => {
    expect(await users(`username=${RUN}%25donor`)).toEqual([])
    expect(await users(`username=${RUN}_donor`)).toEqual([])
    expect((await users(`username=${RUN}`)).length).toBe(5)
  })
})

describe('I10 the public MCP tools leave out hidden and draft projects', () => {
  smoke('get_project and get_comments: not found', async () => {
    for (const p of [hidden, draft]) {
      expect(await tool('get_project', { slug: p.slug })).toEqual({
        error: `No project found with slug "${p.slug}"`,
      })
      expect(await tool('get_comments', { project_slug: p.slug })).toEqual({
        error: `No project found with slug "${p.slug}"`,
      })
    }
  })
  standard('search: neither hidden, draft nor dummy projects', async () => {
    const r = await tool('search_projects', { query: RUN, limit: 50 })
    const slugs = r.projects.map((p: any) => p.slug).sort()
    expect(slugs).toEqual([active.slug, proposal.slug].sort())
  })
  standard('get_user lists only the visible projects', async () => {
    const u = await tool('get_user', { username: creator.username })
    const slugs = u.projects.map((p: any) => p.slug)
    expect(slugs).toEqual(expect.arrayContaining([active.slug, proposal.slug]))
    expect(slugs).not.toContain(hidden.slug)
    expect(slugs).not.toContain(draft.slug)
  })
})

describe('I11 search_projects', () => {
  standard('without an embedding key: keyword matching, saying search is degraded', async () => {
    const r = await tool('search_projects', { query: RUN })
    expect(r.search_mode).toBe('keyword')
    expect(r.warning).toContain('tell the user search is degraded')
  })
  standard(
    'without a query: the newest proposals and active projects; one other stage on request',
    async () => {
      const r = await tool('search_projects', { limit: 50 })
      expect(r.search_mode).toBe('recent')
      expect(r.projects.every((p: any) => ['proposal', 'active'].includes(p.stage))).toBe(true)
      const times = r.projects.map((p: any) => p.created_at)
      expect([...times].sort().reverse()).toEqual(times)
      const done = await tool('search_projects', { stage: 'complete', limit: 5 })
      expect(done.projects.every((p: any) => p.stage === 'complete')).toBe(true)
    }
  )
  standard('by cause', async () => {
    const r = await tool('search_projects', { query: RUN, cause: causeSlug })
    expect(r.projects.map((p: any) => p.slug)).toEqual([proposal.slug])
  })
})

describe('I12 what each project in a result carries', () => {
  standard(
    'link, raised (pending offers for a proposal), score, votes, comments, creator, causes, close date',
    async () => {
      const r = await tool('search_projects', { query: RUN })
      const p = r.projects.find((x: any) => x.slug === proposal.slug)
      expect(p).toMatchObject({
        url: `https://manifund.org/projects/${proposal.slug}`,
        total_raised: 20,
        votes: 0,
        comment_count: 0,
        creator: { username: creator.username, full_name: 'Test creator' },
        close_date: null,
      })
      expect(typeof p.score).toBe('number')
      expect(p.causes.map((c: any) => c.slug)).toEqual([causeSlug])
      const a = r.projects.find((x: any) => x.slug === active.slug)
      expect(a.total_raised).toBe(30)
      expect(a.comment_count).toBe(7)
    }
  )
})

describe('I13 get_project', () => {
  standard(
    'description, donations with names (no share trades), 5 newest comments, similar projects',
    async () => {
      const p = await tool('get_project', { slug: active.slug })
      expect(p.description.trim()).toBe('A test project.')
      expect(p.donations.map((d: any) => [d.amount, d.type, d.from?.username])).toEqual([
        [30, 'project donation', donor.username],
      ])
      expect(p.recent_comments).toHaveLength(5)
      expect(p.recent_comments[0].content.trim()).toBe(`a reply ${RUN}`)
      expect(p.recent_comments[0].is_reply).toBe(true)
      expect(p.recent_comments[1].content.trim()).toBe(`comment 6 ${RUN}`)
      expect(Array.isArray(p.similar_projects)).toBe(true)
    }
  )
})

describe('I14 get_comments', () => {
  standard('newest first, replies included, Markdown, limited', async () => {
    const all = await tool('get_comments', { project_slug: active.slug, limit: 100 })
    expect(all.map((c: any) => c.id)).toEqual([replyId, ...[...comments].reverse()])
    expect(all[0].replying_to).toBe(comments[0])
    expect(all[1].content.trim()).toBe(`comment 6 ${RUN}`)
    expect(await tool('get_comments', { project_slug: active.slug, limit: 2 })).toHaveLength(2)
  })
})

describe('I15 recommend_projects', () => {
  // What it answers depends on the server's embedding key (none, or one the local network guard blocks).
  test.todo('I15 the ranking, and the error pointing to search_projects without an embedding key', () => {})
})

describe('I16 search_users and get_user', () => {
  standard('search_users: username or name, any case, with the profile link', async () => {
    const r = await tool('search_users', { query: `${RUN}-DONOR` })
    expect(r.map((u: any) => u.username)).toEqual([donor.username])
    expect(r[0].url).toBe(`https://manifund.org/${donor.username}`)
    const byName = await tool('search_users', { query: 'test trader2' })
    expect(byName.map((u: any) => u.username)).toContain(trader2.username)
  })
  standard(
    'get_user: profile, total balance, projects, latest USD txns without share trades, no id',
    async () => {
      const u = await tool('get_user', { username: donor.username })
      expect(u.balance).toBe(70)
      expect(u.id).toBeUndefined()
      expect(u.recent_txns.map((t: any) => t.type)).toEqual(['project donation', 'deposit'])
      const t = await tool('get_user', { username: trader.username })
      expect(t.recent_txns).toEqual([])
      expect(await tool('get_user', { username: donor.username.toUpperCase() })).toEqual({
        error: `No user found with username "${donor.username.toUpperCase()}"`,
      })
    }
  )
})

describe('I17 get_txns', () => {
  standard('by user, newest first; share trades only when asked', async () => {
    const d = await tool('get_txns', { username: donor.username })
    const times = d.map((t: any) => t.created_at)
    expect([...times].sort().reverse()).toEqual(times)
    expect(d.map((t: any) => t.id)).toContain(depositId)
    expect(await tool('get_txns', { username: trader.username })).toEqual([])
    expect(
      await tool('get_txns', { username: trader.username, include_cert_txns: true })
    ).toHaveLength(1)
    expect(
      await tool('get_txns', { username: trader.username, type: 'user to user trade' })
    ).toHaveLength(1)
  })
  standard('by project, type, token and dates (both ends included)', async () => {
    const onActive = await tool('get_txns', { project_slug: active.slug })
    expect(onActive.map((t: any) => t.amount)).toEqual([30])
    expect(
      await tool('get_txns', { project_slug: active.slug, token: active.id, type: 'mint cert' })
    ).toHaveLength(1)
    const deposits = await tool('get_txns', { username: donor.username, type: 'deposit' })
    expect(deposits.map((t: any) => t.id)).toEqual([depositId])
    const at = deposits[0].created_at
    // Times go in at millisecond precision; the database keeps microseconds, so `before` is the next millisecond.
    const nextMs = new Date(new Date(at).getTime() + 1).toISOString()
    expect(
      await tool('get_txns', {
        username: donor.username,
        type: 'deposit',
        after: at,
        before: nextMs,
      })
    ).toHaveLength(1)
    expect(
      await tool('get_txns', { username: donor.username, type: 'deposit', after: nextMs })
    ).toHaveLength(0)
    expect(deposits[0].from).toBeNull()
    expect(deposits[0].to.username).toBe(donor.username)
  })
  standard('an unknown user or project is an error', async () => {
    expect((await tool('get_txns', { username: `${RUN}-nobody` })).error).toContain('No user found')
    expect((await tool('get_txns', { project_slug: `${RUN}-nothing` })).error).toContain(
      'No project found'
    )
  })
})

describe('I18 get_user_balances', () => {
  standard('total balances, and the usernames not found', async () => {
    const r = await tool('get_user_balances', {
      usernames: [donor.username, creator.username, `${RUN}-nobody`],
    })
    expect(r.balances.sort((a: any, b: any) => a.username.localeCompare(b.username))).toEqual(
      [
        { username: donor.username, balance: 70 },
        { username: creator.username, balance: 30 },
      ].sort((a, b) => a.username.localeCompare(b.username))
    )
    expect(r.not_found).toEqual([`${RUN}-nobody`])
  })
})

describe('I19 list_causes', () => {
  standard('every cause, in the sort order', async () => {
    const r = await tool('list_causes')
    const rows = await sql`select slug, title, subtitle, open, prize, sort from causes`
    const bySlug = new Map<string, any>(rows.map((c: any) => [c.slug, c]))
    expect(r.map((c: any) => c.slug).sort()).toEqual(rows.map((c: any) => c.slug).sort())
    expect(r[0]).toEqual({
      slug: r[0].slug,
      title: bySlug.get(r[0].slug).title,
      subtitle: bySlug.get(r[0].slug).subtitle,
      open: bySlug.get(r[0].slug).open,
      prize: bySlug.get(r[0].slug).prize,
    })
    const sorts = r.map((c: any) => bySlug.get(c.slug).sort ?? Infinity)
    expect([...sorts].sort((a, b) => a - b)).toEqual(sorts)
  })
})

describe('I21 the admin server refuses a wrong token', () => {
  smoke('a random token is a 401 (the dev server has no MCP_ADMIN_TOKEN)', async () => {
    const r = await rpc(`${env.baseUrl}/api/mcp-admin/${crypto.randomUUID()}/mcp`, 'tools/list', {})
    expect(r.status).toBe(401)
  })
})

// The admin server in-process, reading the local database with the service role (never a remote one).
describe('I22 the admin server: hidden and draft projects, ids, emails, Stripe records', () => {
  let adminTool: (name: string, args?: object) => Promise<any>
  beforeAll(async () => {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(env.supabaseUrl) || !env.serviceKey)
      throw new Error('the admin tests need the local Supabase')
    for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL_DEV'])
      process.env[k] = env.supabaseUrl
    for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY_DEV'])
      process.env[k] = env.serviceKey
    const token = crypto.randomUUID()
    process.env.MCP_ADMIN_TOKEN = token
    const { POST } = await import('@/app/api/mcp-admin/[token]/[transport]/route')
    const handler = (req: Request) => (POST as any)(req, { params: Promise.resolve({ token }) })
    adminTool = (name, args = {}) =>
      tool(name, args, `http://localhost/api/mcp-admin/${token}/mcp`, handler)
  })
  afterAll(() => {
    delete process.env.MCP_ADMIN_TOKEN
  })

  standard(
    'get_project, get_comments and get_user include hidden and draft projects; get_user gives the id',
    async () => {
      expect((await adminTool('get_project', { slug: hidden.slug })).stage).toBe('hidden')
      expect(
        (await adminTool('get_comments', { project_slug: draft.slug })).map((c: any) => c.id)
      ).toEqual([onDraft])
      const u = await adminTool('get_user', { username: creator.username })
      expect(u.id).toBe(creator.id)
      expect(u.projects.map((p: any) => p.slug)).toEqual(
        expect.arrayContaining([hidden.slug, draft.slug])
      )
    }
  )
  standard('lookup_users: by email, username or name, with the email', async () => {
    const email = `${donor.username}@local.test`
    expect(await adminTool('lookup_users', { emails: [email] })).toEqual([
      {
        id: donor.id,
        username: donor.username,
        full_name: 'Test donor',
        type: 'individual',
        email,
      },
    ])
    const byName = await adminTool('lookup_users', { usernames: [trader2.username] })
    expect(byName.map((u: any) => u.email)).toEqual([`${trader2.username}@local.test`])
  })
  standard('get_stripe_txns: card deposits with the depositor’s email', async () => {
    const [row] = await sql`insert into stripe_txns (session_id, customer_id, amount, txn_id)
                            values (${RUN + '-session'}, ${donor.id}, 100, ${depositId}) returning id, created_at`
    try {
      const r = await adminTool('get_stripe_txns', {
        after: new Date(row.created_at).toISOString(),
        limit: 500,
      })
      const mine = r.find((t: any) => t.id === row.id)
      expect(mine).toMatchObject({
        session_id: `${RUN}-session`,
        customer_email: `${donor.username}@local.test`,
      })
    } finally {
      await sql`delete from stripe_txns where id = ${row.id}`
    }
  })
  test.todo('I22 query_sql and get_database_schema end to end: the local database lacks the role membership production has (the SQL function is checked in tests/ai-reference/db/api.test.ts)', () => {})
})
