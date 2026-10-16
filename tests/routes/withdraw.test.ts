// Stripe withdrawals (/api/stripe-connect-withdraw): the amount checks, which come before anything
// reaches Stripe. The test accounts have no Stripe account, so an accepted amount stops at "Set up
// your Stripe account"; the transfer itself isn't exercised here (it needs Stripe).
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { smoke, standard } from '../helpers/levels'

let alice: Client
let before: number
const withdrawalTxns = async () =>
  (
    await sql`select count(*)::int as n from txns where from_id = ${alice.id} and type = 'withdraw'`
  )[0].n as number
beforeAll(async () => {
  alice = await as('alice')
  before = await withdrawalTxns()
})

const withdraw = (who: Client, dollarAmount: unknown) =>
  who.post('/api/stripe-connect-withdraw', dollarAmount === undefined ? {} : { dollarAmount })

const noWithdrawalTxns = async () => expect(await withdrawalTxns()).toBe(before)

describe('Stripe withdrawals', () => {
  smoke('amounts in dollars and cents from $1 to $10,000 pass the amount checks', async () => {
    for (const amount of [1, 19.99, 4.35, 1.15, 10_000]) {
      const r = await withdraw(alice, amount)
      expect([amount, r.status, r.body?.error]).toEqual([
        amount,
        400,
        'Set up your Stripe account before withdrawing.',
      ])
    }
    await noWithdrawalTxns()
  })

  standard('an amount that is not dollars and cents is refused', async () => {
    for (const amount of [10.001, 0.005, '19.99', null, undefined, true, [19.99]]) {
      const r = await withdraw(alice, amount)
      expect([amount, r.status, r.body?.error]).toEqual([
        amount,
        400,
        'Enter an amount in dollars and cents.',
      ])
    }
    await noWithdrawalTxns()
  })

  standard('below $1 and above $10,000 are refused, saying the limit', async () => {
    for (const amount of [0.5, 0, -5]) {
      const r = await withdraw(alice, amount)
      expect([amount, r.status, r.body?.error]).toEqual([
        amount,
        400,
        'The minimum withdrawal is $1.',
      ])
    }
    for (const amount of [10_000.01, 25_000]) {
      const r = await withdraw(alice, amount)
      expect(r.status).toBe(400)
      expect(r.body?.error).toContain('Withdrawals through Stripe are up to $10,000.')
    }
    await noWithdrawalTxns()
  })

  standard('signed out, nothing is checked or written', async () => {
    const r = await withdraw(anonymous(), 19.99)
    expect(r.status).toBe(401)
  })
})
