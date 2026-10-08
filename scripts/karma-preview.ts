// Preview karma scores and the resulting homepage order without touching the DB.
//
//   bun run scripts/karma-preview.ts --out report.md [--html report.html]
//     [--config overrides.json] [--top 50] [--watch username,project-slug,...]
import { readFileSync, writeFileSync } from 'fs'
import { parseArgs } from 'util'
import { createAdminClient } from '@/db/edge'
import { loadKarmaInputs } from '@/db/karma'
import { listProjects } from '@/db/project'
import { hotScore } from '@/utils/sort'
import { isSlopProject } from '@/utils/slop'
import { sortBy } from 'es-toolkit'
import {
  computeKarma,
  KARMA_CONFIG,
  KarmaConfig,
  projectHotScore,
  ProfileKarmaBreakdown,
  ProjectKarmaBreakdown,
} from '@/utils/karma'

const { values: args } = parseArgs({
  options: {
    out: { type: 'string' },
    html: { type: 'string' },
    config: { type: 'string' },
    top: { type: 'string', default: '50' },
    watch: { type: 'string', default: '' },
  },
})

const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : n.toFixed(1))

type Table = { title: string; headers: string[]; rows: (string | number)[][] }

function toMarkdown(sections: (Table | string)[]) {
  return sections
    .map((s) => {
      if (typeof s === 'string') return s
      const head = `| ${s.headers.join(' | ')} |\n| ${s.headers.map(() => '---').join(' | ')} |`
      const body = s.rows.map((r) => `| ${r.join(' | ')} |`).join('\n')
      return `## ${s.title}\n\n${head}\n${body}`
    })
    .join('\n\n')
}

function toHtml(sections: (Table | string)[]) {
  const esc = (s: string | number) => String(s).replace(/</g, '&lt;')
  const body = sections
    .map((s) => {
      if (typeof s === 'string') return `<pre>${esc(s)}</pre>`
      return `<h2>${esc(s.title)}</h2><table><thead><tr>${s.headers
        .map((h) => `<th>${esc(h)}</th>`)
        .join('')}</tr></thead><tbody>${s.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    })
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Karma preview</title>
<style>body{font:14px system-ui;margin:24px;max-width:1400px}table{border-collapse:collapse;margin-bottom:24px}
td,th{border:1px solid #ddd;padding:4px 8px;text-align:left;white-space:nowrap}th{background:#f3f3f3}
pre{background:#f7f7f7;padding:12px;overflow:auto}</style>${body}`
}

async function main() {
  const config: KarmaConfig = args.config
    ? { ...KARMA_CONFIG, ...JSON.parse(readFileSync(args.config, 'utf8')) }
    : KARMA_CONFIG
  const top = parseInt(args.top ?? '50')
  const watch = new Set(args.watch!.split(',').filter(Boolean))

  const supabase = createAdminClient()
  console.log('Loading inputs...')
  const inputs = await loadKarmaInputs(supabase)
  const counts = Object.fromEntries(
    Object.entries(inputs)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length])
  )
  console.log('Row counts:', counts)

  const result = computeKarma(inputs, config)
  console.log(`Computed in ${result.iterations} iterations (converged: ${result.converged})`)

  const profileById = new Map(inputs.profiles.map((p) => [p.id, p]))
  const projectById = new Map(inputs.projects.map((p) => [p.id, p]))
  const name = (id: string) => {
    const p = profileById.get(id)
    return p ? `${p.full_name} (@${p.username})` : id
  }

  const people = [...result.profiles.entries()].sort((a, b) => b[1].karma - a[1].karma)
  const projects = [...result.projects.entries()].sort((a, b) => b[1].karma - a[1].karma)
  console.log('Loading current hot ranking for comparison...')
  // Mirror the homepage: it hides slop projects by default, then sorts the rest by hotScore.
  // Both rankings below exclude the same slop set.
  const allProjects = await listProjects(supabase)
  const slopIds = new Set(allProjects.filter(isSlopProject).map((p) => p.id))
  const currentHot = sortBy(
    allProjects.filter((p) => !slopIds.has(p.id)),
    [hotScore]
  ).slice(0, 30)

  const now = Date.now()
  const hot = [...result.projects.entries()]
    .filter(([id]) => !slopIds.has(id))
    .map(([id, r]) => ({
      id,
      karma: r.karma,
      hot: projectHotScore(r.karma, projectById.get(id)!.created_at, now, config),
    }))
    .sort((a, b) => b.hot - a.hot)

  const personRow = (
    rank: number | string,
    id: string,
    karma: number,
    b: ProfileKarmaBreakdown
  ) => [
    rank,
    name(id),
    fmt(karma),
    fmt(b.donationsGiven),
    fmt(b.donationsReceived),
    fmt(b.votes),
    fmt(b.reacts),
    b.projectsDonatedTo,
    b.voteCount,
    b.reactCount,
  ]
  const personHeaders = [
    '#',
    'Person',
    'Karma',
    'Given',
    'Received',
    'Votes',
    'Reacts',
    '# proj. donated',
    '# votes',
    '# reacts',
  ]
  const projectRow = (
    rank: number | string,
    id: string,
    karma: number,
    b: ProjectKarmaBreakdown
  ) => {
    const p = projectById.get(id)!
    return [
      rank,
      `${p.title} [${p.stage}]`,
      name(p.creator),
      fmt(karma),
      fmt(b.base),
      fmt(b.votes),
      fmt(b.comments),
      fmt(b.donations),
      fmt(b.creator),
      b.voteCount,
      b.commentCount,
      b.donorCount,
      fmt(b.creatorKarma),
      p.slug,
    ]
  }
  const projectHeaders = [
    '#',
    'Project',
    'Creator',
    'Karma',
    'Base',
    'Votes',
    'Comments',
    'Donations',
    'Creator term',
    '# votes',
    '# comments',
    '# donors',
    'Creator karma',
    'slug',
  ]

  const newTop30 = hot.slice(0, 30)
  const newIds = new Set(newTop30.map((h) => h.id))
  const currentIds = new Set(currentHot.map((p) => p.id))
  const hotRank = new Map(hot.map((h, i) => [h.id, i + 1]))

  const sections: (Table | string)[] = [
    `# Karma preview (${new Date().toISOString()})\n\nRow counts: ${JSON.stringify(counts)}\nIterations: ${result.iterations}, converged: ${result.converged}\n\nConfig:\n${JSON.stringify(config, null, 2)}`,
    {
      title: 'Homepage: new karma sort vs. current hot sort (top 30)',
      headers: ['#', 'NEW: project', 'karma', 'hot', 'CURRENT: project', 'hotScore', 'new rank'],
      rows: newTop30.map((h, i) => {
        const p = projectById.get(h.id)!
        const c = currentHot[i]
        return [
          i + 1,
          `${p.title} [${p.stage}]`,
          fmt(h.karma),
          h.hot.toFixed(3),
          c ? `${c.title} [${c.stage}]` : '',
          c ? (-hotScore(c)).toFixed(3) : '',
          c ? (hotRank.get(c.id) ?? '-') : '',
        ]
      }),
    },
    {
      title: 'Moved into top 30 (new only)',
      headers: ['new #', 'Project', 'Creator', 'karma'],
      rows: newTop30
        .filter((h) => !currentIds.has(h.id))
        .map((h) => {
          const p = projectById.get(h.id)!
          return [hotRank.get(h.id)!, p.title, name(p.creator), fmt(h.karma)]
        }),
    },
    {
      title: 'Dropped out of top 30 (current only)',
      headers: ['current #', 'Project', 'new #', 'karma'],
      rows: currentHot
        .filter((c) => !newIds.has(c.id))
        .map((c, i) => [
          currentHot.indexOf(c) + 1,
          c.title,
          hotRank.get(c.id) ?? '-',
          fmt(result.projects.get(c.id)?.karma ?? 0),
        ]),
    },
    {
      title: `Top ${top} people`,
      headers: personHeaders,
      rows: people.slice(0, top).map(([id, r], i) => personRow(i + 1, id, r.karma, r.breakdown)),
    },
    {
      title: `Top ${top} projects by karma (undecayed)`,
      headers: projectHeaders,
      rows: projects.slice(0, top).map(([id, r], i) => projectRow(i + 1, id, r.karma, r.breakdown)),
    },
  ]

  if (watch.size > 0) {
    const peopleRank = new Map(people.map(([id], i) => [id, i + 1]))
    const projectRank = new Map(projects.map(([id], i) => [id, i + 1]))
    sections.push({
      title: 'Watched people',
      headers: personHeaders,
      rows: inputs.profiles
        .filter((p) => watch.has(p.username))
        .map((p) => {
          const r = result.profiles.get(p.id)
          return r
            ? personRow(peopleRank.get(p.id) ?? '-', p.id, r.karma, r.breakdown)
            : [p.username, 'no karma']
        }),
    })
    sections.push({
      title: 'Watched projects',
      headers: [...projectHeaders, 'homepage #'],
      rows: inputs.projects
        .filter((p) => watch.has(p.slug))
        .map((p) => {
          const r = result.projects.get(p.id)
          return r
            ? [
                ...projectRow(projectRank.get(p.id) ?? '-', p.id, r.karma, r.breakdown),
                hotRank.get(p.id) ?? '-',
              ]
            : [p.slug, 'excluded']
        }),
    })
  }

  // Distribution, to sanity-check the weight tiers
  const dist = [0, 1, 10, 100, 1000].map((t, i, arr) => {
    const hi = arr[i + 1] ?? Infinity
    return [
      `${t} – ${hi === Infinity ? '∞' : hi}`,
      people.filter(([, r]) => r.karma >= t && r.karma < hi).length,
    ]
  })
  sections.push({ title: 'Karma distribution (people)', headers: ['Range', 'Count'], rows: dist })

  if (args.out) {
    writeFileSync(args.out, toMarkdown(sections))
    console.log(`Wrote ${args.out}`)
  }
  if (args.html) {
    writeFileSync(args.html, toHtml(sections))
    console.log(`Wrote ${args.html}`)
  }
  if (!args.out && !args.html) console.log(toMarkdown(sections))
}

void main()
