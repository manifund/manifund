// The weekly summary (N6), through the app's cron route. Email is off locally (fake send), so a sent
// summary shows as the notification rows leaving the 'digest' state. The summary cron claims every
// waiting row, not only this file's.
import { beforeAll, describe, expect } from 'bun:test'
import { tempUser, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN } from '../helpers/content'
import { smoke } from '../helpers/levels'

let alice: Client, bob: Client
const runWeekly = () =>
  fetch(`${env.baseUrl}/api/notifications/weekly`, {
    headers: { authorization: `Bearer ${env.cronSecret}` },
  })

beforeAll(async () => {
  ;[alice, bob] = await Promise.all([tempUser('weekly-alice'), tempUser('weekly-bob')])
  // bob gets comments on his profile in the weekly summary (the default, N3; saved in case an earlier run changed it).
  await bob.post('/api/notifications/settings', { group: 'direct_activity', mode: 'weekly' })
})

describe('N6 the weekly summary sends what people chose to get weekly, once', () => {
  smoke('a weekly notification waits, is sent by the cron, and is not sent twice', async () => {
    if (!env.cronSecret)
      throw new Error('CRON_SECRET is not set for the dev server (local-dev/write-env.sh sets one)')
    expect((await fetch(`${env.baseUrl}/api/notifications/weekly`)).status).toBe(401)
    const c = await alice.post('/api/comments', {
      target: { profile_id: bob.id },
      content: doc(`Weekly ${RUN}`),
    })
    expect(c.status).toBe(201)
    const row = async () =>
      (
        await sql`select email_status, emailed_at from notifications where comment_id = ${c.body.comment.id} and recipient_id = ${bob.id}`
      )[0]
    expect((await row())?.email_status).toBe('digest')

    expect((await runWeekly()).status).toBe(200)
    const after = await row()
    expect(['sent', 'skipped']).toContain(after.email_status)
    expect(after.emailed_at).not.toBeNull()

    expect((await runWeekly()).status).toBe(200)
    expect((await row()).emailed_at?.toISOString()).toBe(after.emailed_at?.toISOString())
  })
})
