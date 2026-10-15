// The one email choice and the "Unsubscribe" link, through the app's API.
import { beforeAll, describe, expect } from 'bun:test'
import { createHmac } from 'node:crypto'
import { anonymous, tempUser, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { smoke, standard } from '../helpers/levels'

let bob: Client
beforeAll(async () => {
  bob = await tempUser('settings-bob')
})
const stored = async () =>
  (await sql`select choice from notification_email where profile_id = ${bob.id}`)[0]?.choice as
    | string
    | undefined

// Same signing as lib/notifications/settings.ts (a key derived from the service-role key).
const stopToken = (profileId: string) =>
  `${profileId}.${createHmac('sha256', `notifications-stop:${env.serviceKey}`).update(profileId).digest('base64url')}`

describe('N4 one choice: instant, daily or never; daily is the default and stores nothing', () => {
  smoke('saving a choice stores it; the default removes it', async () => {
    expect((await bob.post('/api/notifications/settings', { choice: 'immediate' })).status).toBe(
      200
    )
    expect(await stored()).toBe('immediate')
    expect((await bob.post('/api/notifications/settings', { choice: 'never' })).status).toBe(200)
    expect(await stored()).toBe('never')
    expect((await bob.post('/api/notifications/settings', { choice: 'daily' })).status).toBe(200)
    expect(await stored()).toBeUndefined()
  })
  standard('anything else is refused, and visitors cannot save', async () => {
    expect((await bob.post('/api/notifications/settings', { choice: 'weekly' })).status).toBe(400)
    expect((await bob.post('/api/notifications/settings', {})).status).toBe(400)
    expect(
      (await anonymous().post('/api/notifications/settings', { choice: 'never' })).status
    ).toBe(401)
    expect(await stored()).toBeUndefined()
  })
  standard('the choice shows on /notifications', async () => {
    const page = await bob.get('/notifications')
    expect(page.status).toBe(200)
    expect(page.text).toContain('Emails about replies, comments and what you follow')
    expect(page.text).toContain('One email a day with your new notifications')
  })
})

describe('N6 a signed link sets the choice to never, and Undo puts the previous one back', () => {
  smoke('stop, then undo', async () => {
    await bob.post('/api/notifications/settings', { choice: 'immediate' })
    const t = stopToken(bob.id)
    const stop = await anonymous().post('/api/notifications/stop', { t })
    expect(stop.status).toBe(200)
    expect(stop.body.previous).toBe('immediate')
    expect(await stored()).toBe('never')
    expect(
      (await anonymous().post('/api/notifications/stop', { t, undo: 'immediate' })).status
    ).toBe(200)
    expect(await stored()).toBe('immediate')
    await bob.post('/api/notifications/settings', { choice: 'daily' })
  })
  standard('a tampered link changes nothing', async () => {
    expect(
      (await anonymous().post('/api/notifications/stop', { t: `${bob.id}.forged` })).status
    ).toBe(400)
    expect(await stored()).toBeUndefined()
  })
  standard('opening the link (GET) changes nothing', async () => {
    const t = stopToken(bob.id)
    expect((await anonymous().get(`/notifications/stop?t=${encodeURIComponent(t)}`)).status).toBe(
      200
    )
    expect(await stored()).toBeUndefined()
  })
})
