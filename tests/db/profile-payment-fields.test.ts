// Only the server sets accreditation, regrantor status, account type and payout accounts on a profile;
// people keep editing the rest of their profile. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
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

// Every payment field set to something other than its current value.
async function setAll(tx: Tx, id: string) {
  return tx`update profiles set accreditation_status = not accreditation_status,
              regranter_status = not regranter_status, type = 'fund',
              stripe_connect_id = 'acct_x', mercury_recipient_id = 'rcp_x'
            where id = ${id}`
}
const changed = { type: 'fund', stripe_connect_id: 'acct_x', mercury_recipient_id: 'rcp_x' }

describe('U1 payment fields on a profile are set by the server only', () => {
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

  test('the edit-profile form still saves, for a regrantor too', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      for (const who of [p.alice, p.bob]) {
        const before = await row(tx, who.id)
        await actAs(tx, who.id)
        // The same columns app/edit-profile/edit-profile-form.tsx updates (an older page that also sends
        // the payment fields is covered by the test above: they are kept, the rest saves).
        await tx`update profiles set username = ${who.username}, bio = 'form bio', long_description = null,
                   website = 'https://example.org', full_name = 'Form Name', avatar_url = null
                 where id = ${who.id}`
        const after = await row(tx, who.id)
        expect(after).toEqual({ ...before, bio: 'form bio' })
      }
      expect((await row(tx, p.alice.id)).regranter_status).toBe(true)
    }))

  test('visitors still change nothing', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const before = await row(tx, p.bob.id)
      await actAsAnon(tx)
      await setAll(tx, p.bob.id)
      expect(await row(tx, p.bob.id)).toEqual(before)
    }))

  test('the server (service role) still sets all of them', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const before = await row(tx, p.bob.id)
      await tx`set local role service_role`
      await setAll(tx, p.bob.id)
      const after = await row(tx, p.bob.id)
      expect(after).toEqual({
        ...before,
        ...changed,
        accreditation_status: !before.accreditation_status,
        regranter_status: !before.regranter_status,
      })
    }))

  test('the database owner (Supabase dashboard, SQL editor) still sets them', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await tx`set local role postgres`
      await setAll(tx, p.bob.id)
      expect(await row(tx, p.bob.id)).toMatchObject(changed)
    }))

  test('people cannot insert a profile row; sign-up creates it with default payment fields', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      // A signed-in person inserting a second profile: refused by row-level security (no insert policy).
      const id = crypto.randomUUID()
      await actAs(tx, id)
      const refused = await tx`savepoint s`
        .then(
          () =>
            tx`insert into profiles (id, username, type, accreditation_status) values (${id}, 'x-new', 'fund', true)`
        )
        .then(
          () => false,
          () => true
        )
      expect(refused).toBe(true)
      await tx`rollback to savepoint s`
      // Sign-up (auth.users insert) creates the profile through handle_new_user, with the defaults.
      await tx`reset role`
      await tx`insert into auth.users (id, email, raw_user_meta_data) values (${id}, ${id + '@local.test'}, '{}')`
      expect(await row(tx, id)).toMatchObject({
        accreditation_status: false,
        regranter_status: false,
        type: 'individual',
        stripe_connect_id: null,
        mercury_recipient_id: null,
      })
    }))
})
