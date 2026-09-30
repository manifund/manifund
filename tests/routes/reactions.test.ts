// Reactions (C35). The route is still the old pages/api one; the tip fix is planned.
import { beforeAll, describe, expect, test } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client
let commentId: string
beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob] = await Promise.all([as('alice'), as('bob')])
  commentId = (await alice.post('/api/comments', { target: { project: w.project.id }, content: doc(`React to me ${RUN}`) })).body.comment.id
})

describe('C35 reactions', () => {
  standard('reacting adds the emoji once; reacting again takes it back', async () => {
    const count = async () => (await sql`select 1 from comment_rxns where comment_id = ${commentId} and reactor_id = ${bob.id} and reaction = '💡'`).length
    await bob.post('/api/react-to-comment', { commentId, reaction: '💡' })
    expect(await count()).toBe(1)
    await bob.post('/api/react-to-comment', { commentId, reaction: '💡' })
    expect(await count()).toBe(0)
  })
  test.todo('a repeated tip request moves the money once and keeps one reaction', () => {})
})
