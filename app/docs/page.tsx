'use client'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

const apis = [
  {
    name: 'List projects',
    id: 'projects',
    path: '/api/v0/projects',
    description:
      'Return the 100 most recent projects. \n\n' +
      'To get older projects, paginate with the `before` parameter, eg from the `created_at` of the 100th project:\n' +
      '`https://manifund.org/api/v0/projects?before=2025-01-24T19:16:45.757Z`',
    method: 'GET',
    params: [
      {
        name: 'before',
        type: 'ISO 8601 timestamp',
        required: false,
        desc: 'Fetch projects before this time',
      },
    ],
    response: `[
  {
    title: string,
    id: string,
    created_at: string,
    creator: string,
    // URL of the project is https://manifund.org/projects/{slug}
    slug: string,
    blurb: string,
    // Markdown description of the project
    description: string,
    stage: string,
    funding_goal: number,
    min_funding: number,
    type: string,
    profiles: {
      username: string,
      full_name: string
    },
    txns: [],
    bids: [],
    causes: [
      {
        title: string,
        slug: string
      }
    ]
  }
]`,
    curl: `curl https://manifund.org/api/v0/projects`,
  },
  {
    name: 'List comments',
    id: 'comments',
    path: '/api/v0/comments',
    description:
      'Return the 100 most recent comments. \n\n' +
      'To get older comments, paginate with the `before` parameter, eg from the `created_at` of the 100th comment:\n' +
      '`https://manifund.org/api/v0/comments?before=2025-01-24T19:16:45.757Z`',
    method: 'GET',
    params: [
      {
        name: 'before',
        type: 'ISO 8601 timestamp',
        required: false,
        desc: 'Fetch comments before this time',
      },
    ],
    response: `[
  {
    id: string,
    created_at: string,
    // Markdown; null when the comment was removed
    content: string | null,
    commenter: string,
    // Exactly one of project, profile_id, cause_slug is set: what the comment is about
    project: string | null,
    profile_id: string | null,
    cause_slug: string | null,
    profiles: {
      username: string,
      full_name: string
    },
    projects: { title: string, slug: string } | null,
    target_profile: { username: string, full_name: string } | null,
    causes: { title: string, slug: string } | null,
    replying_to: string,
    // "progress update" | "final report" | "grant rationale" | "admin note" | null
    special_type: string,
    edited_at: string | null,
    // Removed comments keep a placeholder: deleted_at is set, removed_reason is the admin's
    // public reason (null when the author deleted it)
    deleted_at: string | null,
    removed_reason: string | null
  }
]`,
    curl: `curl https://manifund.org/api/v0/comments`,
  },
  {
    name: 'List users',
    id: 'users',
    path: '/api/v0/users',
    description:
      'Return the 100 most recently created user profiles. \n\n' +
      'To get older users, paginate with the `before` parameter, eg from the `created_at` of the 100th user:\n' +
      '`https://manifund.org/api/v0/users?before=2025-01-24T19:16:45.757Z`\n\n' +
      'The `id`, `username`, and `name` parameters filter by case-insensitive substring, eg ' +
      '`https://manifund.org/api/v0/users?name=austin`. Combining them narrows the results: every ' +
      'filter given must match.',
    method: 'GET',
    params: [
      {
        name: 'before',
        type: 'ISO 8601 timestamp',
        required: false,
        desc: 'Fetch users created before this time',
      },
      {
        name: 'id',
        type: 'string',
        required: false,
        desc: 'Only users whose id contains this string',
      },
      {
        name: 'username',
        type: 'string',
        required: false,
        desc: 'Only users whose username contains this string',
      },
      {
        name: 'name',
        type: 'string',
        required: false,
        desc: 'Only users whose display name contains this string',
      },
    ],
    response: `[
  {
    id: string,
    created_at: string,
    // URL of the profile is https://manifund.org/{username}
    username: string,
    full_name: string,
    bio: string,
    website: string,
    avatar_url: string,
    // Can be "individual" | "org"
    type: string,
    regranter_status: boolean,
    // Balances in USD. Cash and charity exclude money locked in pending
    // offers, so they can add up to less than total_balance.
    cash_balance: number,
    charity_balance: number,
    total_balance: number,
    // The user's USD transactions, newest first
    txns: [
      {
        id: string,
        created_at: string,
        amount: number,
        type: string,
        from_id: string,
        to_id: string,
        project: string
      }
    ]
  }
]`,
    curl: `curl https://manifund.org/api/v0/users`,
  },
]

export default function ApiDocsPage() {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-56 border-r bg-white p-6 md:block">
        <div className="mb-8 flex items-center gap-2">
          <span className="text-lg tracking-tight">
            <Image
              src="/SolidOrangeManifox.png"
              alt="Manifox"
              width={24}
              height={24}
              className="mr-2 inline-block"
            />
            Manifund API
          </span>
        </div>
        <nav className="space-y-2">
          <a
            href="#mcp"
            className="block w-full rounded px-3 text-left text-gray-700 transition hover:bg-orange-50 hover:text-orange-600"
          >
            MCP server
          </a>
          {apis.map((a) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="block w-full rounded px-3 text-left text-gray-700 transition hover:bg-orange-50 hover:text-orange-600"
            >
              {a.name}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-4 py-10 md:ml-56 md:px-12 lg:px-24">
        <div className="max-w-2xl">
          <h1 className="mb-8 flex items-center gap-2 text-3xl tracking-tight">
            <Image
              src="/SolidOrangeManifox.png"
              alt="Manifox"
              width={32}
              height={32}
              className="inline-block"
            />
            Manifund API
          </h1>
          <p className="mb-10 text-gray-600">
            Manifund makes all of our data public, for developers and LLMs alike. Our endpoints are
            open and require no authentication.
            <br />
            <br />
            Need help, or want to show off something cool? Find us on{' '}
            <Link href="https://discord.gg/ZGsDMWSA5Q" className="text-orange-600 underline">
              Discord
            </Link>
            !
          </p>
          <section id="mcp" className="scroll-mt-24 py-24">
            <div className="mb-8">
              <h2 className="mb-2 text-3xl text-gray-900">MCP server</h2>
              <span className="mr-2 inline-block rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-600">
                MCP
              </span>
              <span className="font-mono text-sm text-gray-700">https://manifund.org/api/mcp</span>
            </div>
            <p className="mb-6 whitespace-pre-wrap text-gray-600">
              Allow agents and LLMs to interact with Manifund's data.The server exposes tools for
              searching projects semantically (&quot;AI safety video projects&quot;), recommending
              projects to donors based on their interests, reading comment threads, looking up
              users, and querying donations and balances — so an AI assistant can answer questions
              like &quot;which projects about forecasting got funded this year?&quot; or
              &quot;recommend 10 projects I&apos;d like&quot; on its own.
            </p>
            <h3 className="mb-2 mt-6 font-semibold text-gray-900">Tools</h3>
            <table className="mb-8 w-full overflow-hidden rounded border text-sm">
              <tbody>
                {[
                  [
                    'search_projects',
                    'Semantic or keyword search over projects, with quality signals (score, votes, comments, funding)',
                  ],
                  [
                    'recommend_projects',
                    "Fundable projects ranked against a donor's interests, quality, and urgency",
                  ],
                  [
                    'get_project',
                    'Full project details: funding, score, donations, recent comments, similar projects',
                  ],
                  ['get_comments', 'Full comment thread on a project, as markdown'],
                  ['search_users', 'Find user profiles by name or username'],
                  ['get_user', 'Profile with balance, projects, and recent transactions'],
                  ['get_user_balances', 'Current USD balances for a set of users'],
                  ['get_txns', 'Money transactions by user, project, type, or date range'],
                  ['list_causes', 'Cause areas for filtering'],
                ].map(([name, desc]) => (
                  <tr key={name} className="border-t first:border-t-0">
                    <td className="p-2 font-mono">{name}</td>
                    <td className="p-2 text-gray-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mb-2 font-semibold text-gray-900">Connecting</h3>
            <p className="mb-2 text-sm text-gray-600">
              On claude.ai or Claude Cowork: Settings → Connectors → Add custom connector, with the
              URL above.
              <br />
              <br />
              From Claude Code:
            </p>
            <pre className="mb-4 overflow-x-auto rounded border border-orange-100 bg-orange-50 p-3 text-xs">
              <code>claude mcp add --transport http manifund https://manifund.org/api/mcp</code>
            </pre>
            <p className="mb-2 text-sm text-gray-600">
              For clients that only support stdio servers, use{' '}
              <span className="font-mono">mcp-remote</span>:
            </p>
            <pre className="mb-8 overflow-x-auto rounded border border-orange-100 bg-orange-50 p-3 text-xs">
              <code>{`{
  "mcpServers": {
    "manifund": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://manifund.org/api/mcp"]
    }
  }
}`}</code>
            </pre>
          </section>
          {apis.map((api) => (
            <section key={api.id} id={api.id} className="scroll-mt-24 py-24">
              <div className="mb-8">
                <h2 className="mb-2 text-3xl text-gray-900">{api.name}</h2>
                <span className="mr-2 inline-block rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-600">
                  {api.method}
                </span>

                <Link
                  href={api.path}
                  className="group inline-block rounded px-2 py-1 text-xs font-semibold text-orange-600"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-gray-700">{api.path}</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                </Link>
              </div>
              <p className="mb-6 whitespace-pre-wrap text-gray-600">{api.description}</p>
              <h3 className="mb-2 mt-6 font-semibold text-gray-900">Query Parameters</h3>
              <table className="mb-8 w-full overflow-hidden rounded border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Required</th>
                    <th className="p-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {api.params.map((param) => (
                    <tr key={param.name} className="border-t">
                      <td className="p-2 font-mono">{param.name}</td>
                      <td className="p-2">{param.type}</td>
                      <td className="p-2">{param.required ? 'Yes' : 'No'}</td>
                      <td className="p-2">{param.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mb-2 font-semibold text-gray-900">Response</h3>
              <pre className="mb-8 overflow-x-auto rounded bg-gray-100 p-4 text-xs">
                <code>{api.response}</code>
              </pre>
              <div className="mb-2 text-xs font-semibold text-gray-500">cURL</div>
              <pre className="mb-8 overflow-x-auto rounded border border-orange-100 bg-orange-50 p-3 text-xs">
                <code>{api.curl}</code>
              </pre>
            </section>
          ))}
        </div>
      </main>

      {/* Code samples column removed for simplicity and to keep all content in the center */}
    </div>
  )
}
