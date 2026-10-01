// Reactions (C35): free emoji toggle; a tip moves the money exactly once, together with its reaction.
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, tempUser, type Client } from '../helpers/http'
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
  commentId = (
    await alice.post('/api/comments', {
      target: { project: w.project.id },
      content: doc(`React to me ${RUN}`),
    })
  ).body.comment.id
})

const react = (who: Client, reaction: string, id = commentId) =>
  who.post(`/api/comments/${id}/react`, { reaction })

describe('C35 reactions', () => {
  standard('reacting adds the emoji once; reacting again takes it back', async () => {
    const count = async () =>
      (
        await sql`select 1 from comment_rxns where comment_id = ${commentId} and reactor_id = ${bob.id} and reaction = '💡'`
      ).length
    expect((await react(bob, '💡')).body).toEqual({ reacted: true, tipped: false })
    expect(await count()).toBe(1)
    expect((await react(bob, '💡')).body).toEqual({ reacted: false, tipped: false })
    expect(await count()).toBe(0)
  })
  standard('refuses visitors, unknown emoji and missing comments', async () => {
    expect(
      (await anonymous().post(`/api/comments/${commentId}/react`, { reaction: '💡' })).status
    ).toBe(401)
    expect((await react(bob, '🦄')).status).toBe(400)
    expect((await react(bob, '💡', '00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })
  standard('a tip needs enough charity balance', async () => {
    const broke = await tempUser('broke-tipper')
    const r = await react(broke, '🧡')
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('charity balance')
    expect((await sql`select 1 from comment_rxns where reactor_id = ${broke.id}`).length).toBe(0)
  })
  standard('a repeated tip request moves the money once and keeps one reaction', async () => {
    const tipper = await tempUser('tipper')
    await sql`insert into txns (from_id, to_id, amount, token, type) values (null, ${tipper.id}, 5, 'USD', 'deposit')`
    // A double click (two at once) and a later repeat.
    const [a, b] = await Promise.all([react(tipper, '🧡'), react(tipper, '🧡')])
    const c = await react(tipper, '🧡')
    for (const r of [a, b, c]) expect(r.status).toBe(200)
    expect([a, b, c].filter((r) => r.body.tipped).length).toBe(1)
    const tips =
      await sql`select to_id, amount from txns where from_id = ${tipper.id} and type = 'tip'`
    expect(tips.length).toBe(1)
    expect(tips[0].to_id).toBe(alice.id)
    expect(Number(tips[0].amount)).toBe(1)
    const rxns =
      await sql`select txn_id from comment_rxns where comment_id = ${commentId} and reactor_id = ${tipper.id} and reaction = '🧡'`
    expect(rxns.length).toBe(1)
    expect(rxns[0].txn_id).not.toBeNull()
  })
})
