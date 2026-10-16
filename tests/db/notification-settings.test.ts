// Who can read and write the email choice, straight from the database. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, inRollback } from '../helpers/db'
import { getPeople, type People } from '../helpers/fixtures'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

describe('N4 people read only their own email choice', () => {
  test("bob sees his row, not alice's", () =>
    inRollback(async (tx) => {
      await tx`delete from notification_email where profile_id in (${p.bob.id}, ${p.alice.id})`
      await tx`insert into notification_email (profile_id, choice) values
        (${p.bob.id}, 'never'), (${p.alice.id}, 'immediate')`
      await actAs(tx, p.bob.id)
      const rows = await tx`select profile_id from notification_email`
      expect(rows.map((r) => r.profile_id)).toEqual([p.bob.id])
    }))
})

describe('N4 only server code writes the email choice', () => {
  test('a signed-in person cannot insert it directly', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.bob.id)
      let error: unknown
      try {
        await tx`insert into notification_email (profile_id, choice) values (${p.bob.id}, 'never')`
      } catch (e) {
        error = e
      }
      expect(error).toBeDefined()
    }))
  test('only the three choices are stored', () =>
    inRollback(async (tx) => {
      let error: unknown
      try {
        await tx`insert into notification_email (profile_id, choice) values (${p.bob.id}, 'weekly')`
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
