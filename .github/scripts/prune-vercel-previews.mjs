// Deletes Vercel preview deployments that are no longer needed, so old code doesn't stay online.
// Run by .github/workflows/prune-previews.yml; runnable locally with DRY_RUN=1 (prints, deletes nothing).
//
// MODE=pr-closed  delete every preview of the closed PR's head branch (unless another open PR uses that branch)
// MODE=sweep      for each branch: not used by an open PR (as head or base) and the branch is gone (or its last
//                 PR closed after its last preview) -> delete all its previews; otherwise keep its newest READY
//                 preview and delete the older ones
//
// Never deleted: production deployments, the default branch, deployments still building, deployments without
// git metadata, and any deployment with an alias other than its automatic branch alias.

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') throw new Error(`missing env ${name}`)
  return value
}

if (!process.env.VERCEL_TOKEN) {
  console.log(
    '::notice::VERCEL_TOKEN is not set (e.g. a PR from a fork, or the secret is missing): nothing to do.'
  )
  process.exit(0)
}

const VERCEL_TOKEN = env('VERCEL_TOKEN')
const TEAM_ID = env('VERCEL_TEAM_ID')
const PROJECT_ID = env('VERCEL_PROJECT_ID')
const PROJECT_NAME = env('VERCEL_PROJECT_NAME')
const TEAM_SLUG = env('VERCEL_TEAM_SLUG')
const GITHUB_TOKEN = env('GITHUB_TOKEN')
const REPO = env('GITHUB_REPOSITORY')
const GITHUB_API = env('GITHUB_API_URL', 'https://api.github.com')
const MODE = env('MODE')
const DRY_RUN = ['1', 'true'].includes(process.env.DRY_RUN ?? '')
const ONLY_REF = process.env.ONLY_REF || null // limit to one branch (testing)

const FINAL_STATES = new Set(['READY', 'ERROR', 'CANCELED'])
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const BRANCH_ALIAS = new RegExp(
  `^${escapeRe(PROJECT_NAME)}-git-.+-${escapeRe(TEAM_SLUG)}\\.vercel\\.app$`
)

class NotFound extends Error {}
async function vercel(method, path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.vercel.com${path}${sep}teamId=${TEAM_ID}`, {
    method,
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (res.status === 404) throw new NotFound(path)
  if (!res.ok) throw new Error(`Vercel ${method} ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function github(path) {
  const items = []
  let url = `${GITHUB_API}${path}${path.includes('?') ? '&' : '?'}per_page=100`
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`)
    const body = await res.json()
    if (!Array.isArray(body)) return body
    items.push(...body)
    url = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1]
  }
  return items
}

async function listPreviews() {
  const out = []
  let until = null
  do {
    const page = await vercel(
      'GET',
      `/v6/deployments?projectId=${PROJECT_ID}&limit=100${until ? `&until=${until}` : ''}`
    )
    out.push(...page.deployments)
    until = page.pagination?.next
  } while (until)
  return out.filter((d) => d.target !== 'production')
}

// A preview belongs to (repo id, branch): fork PRs deploy from another repo with possibly the same branch name.
const keyOf = (repoId, ref) => `${repoId}:${ref}`
const deploymentKey = (d) =>
  d.meta?.githubCommitRef && d.meta?.githubCommitRepoId
    ? keyOf(d.meta.githubCommitRepoId, d.meta.githubCommitRef)
    : null

let deleted = 0
let failed = 0
async function remove(d, reason) {
  try {
    await removeOne(d, reason)
  } catch (e) {
    if (e instanceof NotFound) return console.log(`skip ${d.uid}: already gone`)
    failed++
    console.log(`::warning::${d.uid}: ${e.message}`)
  }
}
async function removeOne(d, reason) {
  if (
    d.target === 'production' ||
    d.projectId !== PROJECT_ID ||
    !FINAL_STATES.has(d.readyState ?? d.state)
  ) {
    console.log(`skip ${d.uid}: production, other project, or not final`)
    return
  }
  const { aliases = [] } = await vercel('GET', `/v2/deployments/${d.uid}/aliases`)
  const others = aliases.map((a) => a.alias).filter((a) => !BRANCH_ALIAS.test(a))
  if (others.length) {
    console.log(`skip ${d.uid} (${d.meta.githubCommitRef}): has other aliases ${others.join(', ')}`)
    return
  }
  console.log(
    `${DRY_RUN ? 'would delete' : 'delete'} ${d.uid} https://${d.url} branch=${d.meta.githubCommitRef} (${reason})`
  )
  if (!DRY_RUN) await vercel('DELETE', `/v13/deployments/${d.uid}`)
  deleted++
}

const repoInfo = await github(`/repos/${REPO}`)
const DEFAULT_BRANCH = repoInfo.default_branch
const REPO_ID = String(repoInfo.id)

const openPulls = await github(`/repos/${REPO}/pulls?state=open`)
// Open PRs' head branches, and their base branches when stacked on another branch (its preview may be in use).
const openKeys = new Set([
  ...openPulls.filter((p) => p.head.repo).map((p) => keyOf(p.head.repo.id, p.head.ref)),
  ...openPulls.map((p) => keyOf(REPO_ID, p.base.ref)),
])

const previews = (await listPreviews())
  .filter((d) => deploymentKey(d) && deploymentKey(d) !== keyOf(REPO_ID, DEFAULT_BRANCH))
  .filter((d) => !ONLY_REF || d.meta.githubCommitRef === ONLY_REF)
  .sort((a, b) => b.created - a.created) // newest first

if (MODE === 'pr-closed') {
  const key = keyOf(env('PR_HEAD_REPO_ID'), env('PR_HEAD_REF'))
  if (openKeys.has(key)) {
    console.log('Another open PR uses this branch: keeping its previews.')
  } else {
    for (const d of previews.filter((d) => deploymentKey(d) === key))
      await remove(d, `PR #${env('PR_NUMBER')} closed`)
  }
} else if (MODE === 'sweep') {
  const branches = new Set(
    (await github(`/repos/${REPO}/branches`)).map((b) => keyOf(REPO_ID, b.name))
  )
  const byKey = new Map()
  for (const d of previews) byKey.set(deploymentKey(d), [...(byKey.get(deploymentKey(d)) ?? []), d])

  for (const [key, list] of byKey) {
    const ref = list[0].meta.githubCommitRef
    let active = openKeys.has(key)
    if (!active && branches.has(key)) {
      // The branch exists without an open PR: work in progress, unless a PR from it closed after its last preview.
      const owner = REPO.split('/')[0]
      const closed = await github(
        `/repos/${REPO}/pulls?state=closed&head=${encodeURIComponent(`${owner}:${ref}`)}`
      )
      const lastClosed = Math.max(0, ...closed.map((p) => Date.parse(p.closed_at)))
      active = lastClosed < list[0].created
    }
    if (!active) {
      for (const d of list) await remove(d, 'no open PR, branch gone or PR closed')
      continue
    }
    const newestReady = list.find((d) => (d.readyState ?? d.state) === 'READY')
    if (!newestReady) continue
    for (const d of list.filter((d) => d.created < newestReady.created))
      await remove(d, 'superseded by a newer preview')
  }
} else {
  throw new Error(`unknown MODE ${MODE}`)
}

console.log(
  `${DRY_RUN ? 'Would delete' : 'Deleted'} ${deleted} preview deployment(s), ${failed} failed.`
)
if (failed) process.exit(1)
