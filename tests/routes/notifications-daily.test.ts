// The daily summary (N5), through the app's cron route. Email is off locally (fake send), so a sent summary shows
// as the notification rows leaving the 'digest' state. The summary cron claims every waiting row, not only this
// file's.
import { beforeAll, describe, expect } from 'bun:test'
import { tempUser, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN } from '../helpers/content'
import { smoke } from '../helpers/levels'

let alice: Client, bob: Client
const runDaily = () =>
  fetch(`${env.baseUrl}/api/notifications/daily`, {
    headers: { authorization: `Bearer ${env.cronSecret}` },
  })

beforeAll(async () => {
  ;[alice, bob] = await Promise.all([tempUser('daily-alice'), tempUser('daily-bob')])
  // bob keeps the default, daily (saved in case an earlier run changed it).
  await bob.post('/api/notifications/settings', { choice: 'daily' })
})

describe('N5 the daily summary sends what waits for it, once', () => {
  smoke('an optional notification waits, is sent by the cron, and is not sent twice', async () => {
    if (!env.cronSecret)
      throw new Error('CRON_SECRET is not set for the dev server (local-dev/write-env.sh sets one)')
    expect((await fetch(`${env.baseUrl}/api/notifications/daily`)).status).toBe(401)
    const c = await alice.post('/api/comments', {
      target: { profile_id: bob.id },
      content: doc(`Daily ${RUN}`),
    })
    expect(c.status).toBe(201)
    const row = async () =>
      (
        await sql`select email_status, emailed_at from notifications where comment_id = ${c.body.comment.id} and recipient_id = ${bob.id}`
      )[0]
    expect((await row())?.email_status).toBe('digest')

    expect((await runDaily()).status).toBe(200)
    const after = await row()
    expect(['sent', 'skipped']).toContain(after.email_status)
    expect(after.emailed_at).not.toBeNull()

    expect((await runDaily()).status).toBe(200)
    expect((await row()).emailed_at?.toISOString()).toBe(after.emailed_at?.toISOString())
  })
})
