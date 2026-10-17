// The API reference page (/docs, I2), rendered to HTML. The list of public tools is the one the public MCP server
// registers (pinned in tests/ai-reference/unit/api.test.ts, I9): a new tool should show up here too.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ApiDocsPage from '@/app/docs/page'

const html = renderToStaticMarkup(<ApiDocsPage />)

describe('I2 /docs documents each endpoint and the public MCP server', () => {
  test('each REST endpoint, with its pagination parameter and an example', () => {
    for (const path of ['/api/v0/projects', '/api/v0/comments', '/api/v0/users']) {
      expect(html).toContain(path)
      expect(html).toContain(`curl https://manifund.org${path}`)
    }
    expect(html).toContain('before')
    for (const what of ['id', 'username', 'display name'])
      expect(html).toContain(`Only users whose ${what} contains this string`)
  })
  test('the MCP server: its URL, every public tool, and how to connect from Claude', () => {
    expect(html).toContain('https://manifund.org/api/mcp')
    for (const tool of [
      'search_projects',
      'recommend_projects',
      'get_project',
      'get_comments',
      'search_users',
      'get_user',
      'get_user_balances',
      'get_txns',
      'list_causes',
    ])
      expect(html).toContain(tool)
    expect(html).toContain('claude mcp add --transport http manifund https://manifund.org/api/mcp')
  })
})
