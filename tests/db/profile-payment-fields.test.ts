// Only the server sets accreditation, regrantor status, account type and payout accounts on a profile;
// people keep editing the rest of their profile. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(
    import.meta.dir,
    '../../supabase/migrations/20261012191718_profile_payment_fields_server_only.sql'
  ),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function row(tx: Tx, id: string) {
  await tx`reset role`
  const [r] = await tx`
    select accreditation_status, regranter_status, type, stripe_connect_id, mercury_recipient_id, bio
    from profiles where id = ${id}`
  return r
}

describe('payment fields on a profile are set by the server only', () => {
  test("a person's own update keeps them, and saves the rest", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const before = await row(tx, p.bob.id)
      await actAs(tx, p.bob.id)
      await tx`update profiles set accreditation_status = true, regranter_status = true, type = 'fund',
                 stripe_connect_id = 'acct_x', mercury_recipient_id = 'rcp_x', bio = 'new bio'
               where id = ${p.bob.id}`
      const after = await row(tx, p.bob.id)
      expect(after).toEqual({ ...before, bio: 'new bio' })
    }))
  test('the server still sets them', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await tx`set local role service_role`
      await tx`update profiles set accreditation_status = true, stripe_connect_id = 'acct_x'
               where id = ${p.bob.id}`
      const after = await row(tx, p.bob.id)
      expect(after.accreditation_status).toBe(true)
      expect(after.stripe_connect_id).toBe('acct_x')
    }))
})
