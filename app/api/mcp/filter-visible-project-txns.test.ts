import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { filterVisibleProjectTxns } from './filter-visible-project-txns.ts'

// Test rows are shaped like the public `get_txns` / `get_user.recent_txns`
// response: each row carries amount/type and a nested `project: {title, slug,
// stage}` (or `project: null` for deposits, withdrawals, tips, profile
// donations). The helper's job is to drop rows whose project stage is
// `hidden`/`draft` on the public tier, preserve project-less rows, and strip
// the helper-only `stage` field from the wire shape.

const ROWS = [
  {
    id: 1,
    amount: 10,
    type: 'project donation',
    project: { title: 'P1', slug: 'p1', stage: 'proposal' },
  },
  {
    id: 2,
    amount: 20,
    type: 'project donation',
    project: { title: 'P2', slug: 'p2', stage: 'active' },
  },
  {
    id: 3,
    amount: 30,
    type: 'project donation',
    project: { title: 'Hid', slug: 'hid', stage: 'hidden' },
  },
  {
    id: 4,
    amount: 40,
    type: 'project donation',
    project: { title: 'Drf', slug: 'drf', stage: 'draft' },
  },
]

const NULL_ROWS = [
  { id: 11, amount: 5, type: 'deposit', project: null },
  { id: 12, amount: 6, type: 'withdraw', project: null },
  { id: 13, amount: 7, type: 'tip', project: null },
  { id: 14, amount: 8, type: 'profile donation', project: null },
]

// deepStrictEqual rejects extra keys, so asserting the full object also
// proves the helper-only `stage` field is stripped from every nested project.
const strip = (r: any) =>
  r.project ? { ...r, project: { title: r.project.title, slug: r.project.slug } } : r

test('T1 public tier: drops hidden/draft project rows, keeps proposal/active', () => {
  const out = filterVisibleProjectTxns(ROWS, false)
  assert.deepEqual(out, [strip(ROWS[0]), strip(ROWS[1])])
  assert.equal(out.length, 2)
})

test('T2 public tier: project-less rows (deposits, withdrawals, tips, profile donations) are preserved', () => {
  const out = filterVisibleProjectTxns(NULL_ROWS, false)
  assert.deepEqual(out, NULL_ROWS)
  assert.equal(out.length, 4)
})

test('T3 public tier: nested project keeps only {title, slug} — no stage leak', () => {
  const out = filterVisibleProjectTxns(ROWS, false)
  for (const row of out) {
    if (row.project) {
      assert.deepStrictEqual(row.project, {
        title: row.project.title,
        slug: row.project.slug,
      })
      assert.ok(!('stage' in row.project), `stage leaked: ${JSON.stringify(row.project)}`)
    }
  }
})

test('T4 admin tier: no rows removed (hidden/draft visible) and stage still stripped', () => {
  const out = filterVisibleProjectTxns(ROWS, true)
  assert.deepEqual(out, ROWS.map(strip))
  assert.equal(out.length, 4)
  for (const row of out) {
    if (row.project) assert.ok(!('stage' in row.project))
  }
})

test('T5 public tier: hidden and draft both removed; visible row keeps {title, slug}', () => {
  const mix = [
    { id: 3, amount: 30, project: { title: 'Hid', slug: 'hid', stage: 'hidden' } },
    { id: 4, amount: 40, project: { title: 'Drf', slug: 'drf', stage: 'draft' } },
    { id: 1, amount: 10, project: { title: 'P1', slug: 'p1', stage: 'proposal' } },
  ]
  const out = filterVisibleProjectTxns(mix, false)
  assert.deepEqual(out, [{ id: 1, amount: 10, project: { title: 'P1', slug: 'p1' } }])
})

test('T6 edge: null/undefined input returns []', () => {
  assert.deepEqual(filterVisibleProjectTxns(null, false), [])
  assert.deepEqual(filterVisibleProjectTxns(undefined, false), [])
  assert.deepEqual(filterVisibleProjectTxns(null, true), [])
})

test('public tier: mixed visible + hidden + null rows keeps null and visible, drops hidden', () => {
  const mixed = [
    ...ROWS,
    ...NULL_ROWS,
    {
      id: 99,
      amount: 90,
      type: 'project donation',
      project: { title: 'Cmp', slug: 'cmp', stage: 'complete' },
    },
  ]
  const out = filterVisibleProjectTxns(mixed, false)
  // proposal, active, complete + all 4 null-project rows; hidden/draft dropped.
  // Filter preserves original relative order, so the complete row stays at the
  // end (where it sat in the input after the null-project rows).
  assert.deepEqual(out, [strip(ROWS[0]), strip(ROWS[1]), ...NULL_ROWS, strip(mixed[8])])
  assert.equal(out.length, 7)
  for (const row of out) {
    if (row.project) assert.ok(!('stage' in row.project))
  }
})
