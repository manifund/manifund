// The Network tab through /api/network (docs/product/follows, F10): what people you follow did, newest first.
// Throwaway accounts (the follower follows the maker); the maker's projects carry the run marker, so the run's
// cleanup deletes them.
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, tempUser, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { getWorld, type World } from '../helpers/fixtures'
import { smoke, standard } from '../helpers/levels'

let w: World
let follower: Client, maker: Client, stranger: Client
let made: { id: string; slug: string }

beforeAll(async () => {
  w = await getWorld()
  ;[follower, maker, stranger] = await Promise.all([
    tempUser('net-follower'),
    tempUser('net-maker'),
    tempUser('net-stranger'),
  ])
  expect((await follower.post('/api/follows', { followedId: maker.id })).status).toBe(200)
  made = await create(maker, 'Network project')
  expect(
    (
      await maker.post('/api/comments', {
        target: { project: w.project.id },
        content: doc(`Net ${RUN}`),
      })
    ).status
  ).toBe(201)
  // a donation by the maker to the world project (money moves only through payments; the row is what counts)
  await sql`insert into txns (from_id, to_id, amount, token, project, type)
            values (${maker.id}, ${w.people.alice.id}, 250, 'USD', ${w.project.id}, 'project donation')`
})

async function create(who: Client, title: string) {
  const r = await who.post('/api/create-project', {
    title: `${title} ${RUN}`,
    subtitle: 'test',
    minFunding: 1000,
    fundingGoal: 5000,
    verdictDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    description: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    },
    location: 'Test',
    selectedCauses: [],
    selectedPrize: null,
    founderPercent: 0,
    agreedToTerms: true,
    lobbying: false,
  })
  expect(r.status).toBe(200)
  return r.body as { id: string; slug: string }
}

describe('F10 the Network tab: what people you follow did, newest first', () => {
  smoke('their new project, comment and donation, with links', async () => {
    const r = await follower.get('/api/network')
    expect(r.status).toBe(200)
    const items = r.body.items as any[]
    const mine = items.filter((i) => i.who.id === maker.id)
    expect(mine.map((i) => i.kind).sort()).toEqual(['commented', 'created', 'donated'])
    expect(mine.find((i) => i.kind === 'created').project.slug).toBe(made.slug)
    expect(mine.find((i) => i.kind === 'commented').href).toContain(`/projects/${w.project.slug}`)
    expect(mine.find((i) => i.kind === 'commented').excerpt).toContain(`Net ${RUN}`)
    expect(mine.find((i) => i.kind === 'donated').amount).toBe(250)
    const times = items.map((i) => new Date(i.at).getTime())
    expect(times).toEqual([...times].sort((x, y) => y - x))
  })
  standard('a hidden project leaves the feed', async () => {
    const hidden = await create(maker, 'Hidden network project')
    await sql`update projects set stage = 'hidden' where id = ${hidden.id}`
    const items = (await follower.get('/api/network')).body.items as any[]
    expect(items.some((i) => i.kind === 'created' && i.project.slug === hidden.slug)).toBe(false)
  })
  standard('someone who follows nobody sees an empty feed; visitors get nothing', async () => {
    expect((await stranger.get('/api/network')).body.items).toEqual([])
    expect((await anonymous().get('/api/network')).status).toBe(401)
  })
})
