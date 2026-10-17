// The MCP servers (docs/ai-reference/api/README.md), called in-process through their route handlers: no dev server, no
// database. Only calls that are answered before any database read (the tool list, input checks, the admin token,
// the one-statement check), so nothing here reaches Supabase (bun test loads no Supabase settings anyway).
// The admin token is a random value made here, set on process.env only for these tests and restored after.
import { afterEach, describe, expect, test } from 'bun:test'
import { POST as publicPost } from '@/app/api/mcp/route'
import { POST as transportPost } from '@/app/api/mcp/[transport]/route'
import { POST as adminPost } from '@/app/api/mcp-admin/[token]/[transport]/route'

const PUBLIC_TOOLS = [
  'get_comments',
  'get_project',
  'get_txns',
  'get_user',
  'get_user_balances',
  'list_causes',
  'recommend_projects',
  'search_projects',
  'search_users',
]
const ADMIN_TOOLS = ['get_database_schema', 'get_stripe_txns', 'lookup_users', 'query_sql']

type Handler = (req: Request, ctx?: any) => Promise<Response>

// One JSON-RPC call; the answer comes as a server-sent event (`data: {...}`).
async function call(handler: Handler, url: string, method: string, params: object = {}, ctx?: any) {
  const req = new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const res = await handler(req, ctx)
  const text = await res.text()
  const data = text.split('\n').find((l) => l.startsWith('data: '))
  return { status: res.status, body: data ? JSON.parse(data.slice(6)) : text }
}

const pub = (method: string, params: object = {}) =>
  call(publicPost as Handler, 'http://localhost/api/mcp', method, params)

const tokenCtx = (token: string) => ({ params: Promise.resolve({ token }) })
const admin = (token: string, method: string, params: object = {}) =>
  call(
    adminPost as Handler,
    `http://localhost/api/mcp-admin/${token}/mcp`,
    method,
    params,
    tokenCtx(token)
  )

const savedToken = process.env.MCP_ADMIN_TOKEN
afterEach(() => {
  if (savedToken === undefined) delete process.env.MCP_ADMIN_TOKEN
  else process.env.MCP_ADMIN_TOKEN = savedToken
})
function withTestToken() {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  process.env.MCP_ADMIN_TOKEN = token
  return token
}

async function tools(r: Promise<{ status: number; body: any }>) {
  const { status, body } = await r
  expect(status).toBe(200)
  return body.result.tools as { name: string; inputSchema: any; description: string }[]
}
const schemaOf = async (name: string) =>
  (await tools(pub('tools/list'))).find((t) => t.name === name)!.inputSchema.properties

describe('I9 the public MCP server: its addresses, instructions and nine read tools', () => {
  test('/api/mcp lists the nine public tools', async () => {
    expect((await tools(pub('tools/list'))).map((t) => t.name).sort()).toEqual(PUBLIC_TOOLS)
  })
  test('/api/mcp/mcp lists the same tools', async () => {
    const list = await tools(
      call(transportPost as Handler, 'http://localhost/api/mcp/mcp', 'tools/list')
    )
    expect(list.map((t) => t.name).sort()).toEqual(PUBLIC_TOOLS)
  })
  test('initializing gives the client instructions about Manifund', async () => {
    const { status, body } = await pub('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
    expect(status).toBe(200)
    expect(body.result.instructions).toContain('https://manifund.org')
    expect(body.result.instructions).toContain('recommend_projects')
  })
})

describe('I11 I14 I15 I16 I17 I18 the public tools take inputs within their ranges', () => {
  test('I11 search_projects: 1 to 50 results (10 by default); stages proposal, active, complete, not funded', async () => {
    const s = await schemaOf('search_projects')
    expect([s.limit.minimum, s.limit.maximum, s.limit.default]).toEqual([1, 50, 10])
    expect(s.stage.enum).toEqual(['proposal', 'active', 'complete', 'not funded'])
  })
  test('I14 get_comments: 1 to 100 (20 by default)', async () => {
    const s = await schemaOf('get_comments')
    expect([s.limit.minimum, s.limit.maximum, s.limit.default]).toEqual([1, 100, 20])
  })
  test('I15 recommend_projects: 1 to 30 (10 by default), optional causes and budget', async () => {
    const s = await schemaOf('recommend_projects')
    expect([s.limit.minimum, s.limit.maximum, s.limit.default]).toEqual([1, 30, 10])
    expect(s.causes.type).toBe('array')
    expect(s.budget.type).toBe('number')
  })
  test('I16 search_users: 1 to 50 (10 by default)', async () => {
    const s = await schemaOf('search_users')
    expect([s.limit.minimum, s.limit.maximum, s.limit.default]).toEqual([1, 50, 10])
  })
  test('I17 get_txns: 1 to 500 (100 by default), USD by default, share trades left out by default', async () => {
    const s = await schemaOf('get_txns')
    expect([s.limit.minimum, s.limit.maximum, s.limit.default]).toEqual([1, 500, 100])
    expect(s.token.default).toBe('USD')
    expect(s.include_cert_txns.default).toBe(false)
    for (const t of [
      'user to user trade',
      'user to amm trade',
      'inject amm liquidity',
      'mint cert',
    ])
      expect(s.include_cert_txns.description).toContain(t)
  })
  test('I18 get_user_balances: 1 to 50 usernames', async () => {
    const s = await schemaOf('get_user_balances')
    expect([s.usernames.minItems, s.usernames.maxItems]).toEqual([1, 50])
  })
})

describe('I20 a tool that cannot answer returns an error result, not a server error', () => {
  test('an input out of range', async () => {
    const { status, body } = await pub('tools/call', {
      name: 'search_projects',
      arguments: { limit: 0 },
    })
    expect(status).toBe(200)
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain('limit')
  })
  test('a hidden stage is not an input the public search takes', async () => {
    const { body } = await pub('tools/call', {
      name: 'search_projects',
      arguments: { stage: 'hidden' },
    })
    expect(body.result.isError).toBe(true)
  })
  test('an admin tool asked nothing says what it needs', async () => {
    const token = withTestToken()
    const { status, body } = await admin(token, 'tools/call', {
      name: 'lookup_users',
      arguments: {},
    })
    expect(status).toBe(200)
    expect(body.result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Provide at least one of emails, usernames, or full_names' }],
    })
  })
})

describe('I21 the admin MCP server needs the server’s token', () => {
  test('without MCP_ADMIN_TOKEN set, every token is refused', async () => {
    delete process.env.MCP_ADMIN_TOKEN
    expect((await admin('anything', 'tools/list')).status).toBe(401)
    expect((await admin('', 'tools/list')).status).toBe(401)
  })
  test('a wrong token of the same length, or of another length, is refused', async () => {
    const token = withTestToken()
    const wrong = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect((await admin(wrong, 'tools/list')).status).toBe(401)
    expect((await admin(token + 'x', 'tools/list')).status).toBe(401)
    expect((await admin(token.slice(1), 'tools/list')).status).toBe(401)
  })
  test('the right token opens it', async () => {
    const token = withTestToken()
    expect((await admin(token, 'tools/list')).status).toBe(200)
  })
})

describe('I22 the admin server has the public tools plus four admin tools', () => {
  test('tool list', async () => {
    const token = withTestToken()
    const names = (await tools(admin(token, 'tools/list'))).map((t) => t.name).sort()
    expect(names).toEqual([...PUBLIC_TOOLS, ...ADMIN_TOOLS].sort())
  })
  test('the public server has none of the admin tools', async () => {
    const { body } = await pub('tools/call', { name: 'query_sql', arguments: { sql: 'select 1' } })
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain('not found')
  })
})

describe('I23 query_sql runs one statement, up to 1,000 rows', () => {
  test('two statements are refused before reaching the database', async () => {
    const token = withTestToken()
    const { body } = await admin(token, 'tools/call', {
      name: 'query_sql',
      arguments: { sql: 'select 1; select 2' },
    })
    expect(body.result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Only a single SQL statement is allowed' }],
    })
  })
  test('max_rows: 1 to 1,000, 200 by default', async () => {
    const token = withTestToken()
    const list = await tools(admin(token, 'tools/list'))
    const s = list.find((t) => t.name === 'query_sql')!.inputSchema.properties
    expect([s.max_rows.minimum, s.max_rows.maximum, s.max_rows.default]).toEqual([1, 1000, 200])
  })
})
