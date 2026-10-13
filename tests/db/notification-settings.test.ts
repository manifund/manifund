// Who can read and write notification settings, straight from the database. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, inRollback } from '../helpers/db'
import { getPeople, type People } from '../helpers/fixtures'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

describe('N3 people read only their own notification settings', () => {
  test("bob sees his row, not alice's", () =>
    inRollback(async (tx) => {
      await tx`delete from notification_settings where profile_id in (${p.bob.id}, ${p.alice.id})`
      await tx`insert into notification_settings (profile_id, group_key, email) values
        (${p.bob.id}, 'money_to_you', 'off'), (${p.alice.id}, 'money_to_you', 'off')`
      await actAs(tx, p.bob.id)
      const rows = await tx`select profile_id from notification_settings`
      expect(rows.map((r) => r.profile_id)).toEqual([p.bob.id])
    }))
})

describe('N4 only server code writes notification settings', () => {
  test('a signed-in person cannot insert a setting directly', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.bob.id)
      let error: unknown
      try {
        await tx`insert into notification_settings (profile_id, group_key, email) values (${p.bob.id}, 'money_to_you', 'off')`
      } catch (e) {
        error = e
      }
      expect(error).toBeDefined()
    }))
})

describe('N1 notifications can be about projects, offers, transactions and withdrawals', () => {
  test('a donation notification without a comment is valid', () =>
    inRollback(async (tx) => {
      const [n] = await tx`insert into notifications (recipient_id, reason, amount, email_status)
        values (${p.bob.id}, 'donation_to_your_project', 7, 'digest') returning reason, email_status`
      expect(n.reason).toBe('donation_to_your_project')
      expect(n.email_status).toBe('digest')
    }))
})
