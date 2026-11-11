// Giving as a fund (F2): bob runs a fund made for the run, alice doesn't. Everything the tests write (the
// fund, its admin row, its txns and offers, the proposal) is deleted at the end.
import { afterAll, beforeAll, describe, expect } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, makeProject, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client
let bob: Client
let fundId: string
let proposal: { id: string }

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob] = await Promise.all([as('alice'), as('bob')])
  const [fund] = await sql`
    insert into profiles (username, full_name, type) values (${`${RUN}-fund`}, 'Test fund', 'fund')
    returning id`
  fundId = fund.id
  await sql`insert into fund_admins (fund_id, profile_id) values (${fundId}, ${w.people.bob.id})`
  await sql`insert into txns (from_id, to_id, amount, token, type)
            values (${w.people.rita.id}, ${fundId}, 1000, 'USD', 'profile donation')`
  proposal = await makeProject(sql, w.people.alice.id, 'proposal', `${RUN}-funds-proposal`)
})

afterAll(async () => {
  await sql`delete from bids where bidder = ${fundId}`
  await sql`delete from txns where from_id = ${fundId} or to_id = ${fundId}`
  await sql`delete from profiles where id = ${fundId}`
})

const fundTxns = async () =>
  Array.from(
    await sql`select to_id, amount::float as amount, type, project from txns where from_id = ${fundId}`
  )

describe('F2 only a fund’s admins give from it', () => {
  smoke('an admin donates from the fund to an active project', async () => {
    const r = await bob.post('/api/transfer-money', {
      fromId: fundId,
      toId: alice.id,
      amount: 40,
      projectId: w.project.id,
    })
    expect(r.status).toBe(200)
    expect(await fundTxns()).toMatchObject([
      { to_id: alice.id, amount: 40, type: 'project donation', project: w.project.id },
    ])
  })

  standard('someone else cannot donate from the fund', async () => {
    const before = (await fundTxns()).length
    const r = await alice.post('/api/transfer-money', {
      fromId: fundId,
      toId: alice.id,
      amount: 30,
      projectId: w.project.id,
    })
    expect(r.status).not.toBe(200)
    expect((await fundTxns()).length).toBe(before)
  })

  smoke('an admin offers from the fund on a proposal', async () => {
    const r = await bob.post('/api/place-bid', {
      projectId: proposal.id,
      valuation: 0,
      amount: 25,
      type: 'donate',
      asFundId: fundId,
    })
    expect(r.status).toBe(200)
    const bids =
      await sql`select amount::float as amount, status from bids where bidder = ${fundId}`
    expect(Array.from(bids)).toMatchObject([{ amount: 25, status: 'pending' }])
  })

  standard('someone else cannot offer as the fund', async () => {
    const r = await alice.post('/api/place-bid', {
      projectId: proposal.id,
      valuation: 0,
      amount: 25,
      type: 'donate',
      asFundId: fundId,
    })
    expect(r.status).toBe(401)
  })

  standard('the fund’s balance, not the admin’s, limits what they give', async () => {
    const r = await bob.post('/api/place-bid', {
      projectId: proposal.id,
      valuation: 0,
      amount: 5000,
      type: 'donate',
      asFundId: fundId,
    })
    expect(r.status).toBe(401)
  })
})
