// Notification settings and "stop emails like this" links, through the app's API.
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
const setting = async (group: string) =>
  (
    await sql`select email from notification_settings where profile_id = ${bob.id} and group_key = ${group}`
  )[0]?.email as string | undefined

// Same signing as lib/notifications/settings.ts (a key derived from the service-role key).
const stopToken = (profileId: string, ...groups: string[]) => {
  const payload = `${profileId}.${groups.join(',')}`
  const sig = createHmac('sha256', `notifications-stop:${env.serviceKey}`)
    .update(payload)
    .digest('base64url')
  return `${payload}.${sig}`
}

describe('N3 N4 people choose right away or weekly per group; always-emailed groups and other modes are refused', () => {
  smoke('saving a choice stores an override; the default removes it', async () => {
    expect(
      (await bob.post('/api/notifications/settings', { group: 'direct_activity', mode: 'instant' }))
        .status
    ).toBe(200)
    expect(await setting('direct_activity')).toBe('instant')
    expect(
      (await bob.post('/api/notifications/settings', { group: 'direct_activity', mode: 'weekly' }))
        .status
    ).toBe(200) // the default (N3)
    expect(await setting('direct_activity')).toBeUndefined()
  })
  standard('always-emailed groups and anything but the two choices are refused', async () => {
    expect(
      (await bob.post('/api/notifications/settings', { group: 'records', mode: 'weekly' })).status
    ).toBe(400)
    expect(
      (await bob.post('/api/notifications/settings', { group: 'moderation', mode: 'weekly' }))
        .status
    ).toBe(400)
    expect(
      (await bob.post('/api/notifications/settings', { group: 'money_to_you', mode: 'daily' }))
        .status
    ).toBe(400)
    expect(
      (await bob.post('/api/notifications/settings', { group: 'money_to_you', mode: 'off' })).status
    ).toBe(400) // only an email's unsubscribe button (N7)
    expect(await setting('money_to_you')).toBeUndefined()
  })
  standard('visitors cannot save settings', async () => {
    expect(
      (
        await anonymous().post('/api/notifications/settings', {
          group: 'money_to_you',
          mode: 'weekly',
        })
      ).status
    ).toBe(401)
  })
})

describe('N7 a signed link unsubscribes from the kinds of email it came with, and Undo restores them', () => {
  smoke('stop, then undo', async () => {
    const t = stopToken(bob.id, 'money_to_you')
    expect((await anonymous().post('/api/notifications/stop', { t })).status).toBe(200)
    expect(await setting('money_to_you')).toBe('off')
    expect((await anonymous().post('/api/notifications/stop', { t, undo: true })).status).toBe(200)
    expect(await setting('money_to_you')).toBeUndefined()
  })
  smoke("a weekly summary's link covers every kind it listed", async () => {
    const t = stopToken(bob.id, 'direct_activity', 'money_you_gave')
    expect((await anonymous().post('/api/notifications/stop', { t })).status).toBe(200)
    expect(await setting('direct_activity')).toBe('off')
    expect(await setting('money_you_gave')).toBe('off')
    expect((await anonymous().post('/api/notifications/stop', { t, undo: true })).status).toBe(200)
    expect(await setting('direct_activity')).toBeUndefined()
    expect(await setting('money_you_gave')).toBeUndefined()
  })
  standard('choosing again in the settings subscribes again', async () => {
    expect(
      (await anonymous().post('/api/notifications/stop', { t: stopToken(bob.id, 'your_projects') }))
        .status
    ).toBe(200)
    expect(
      (await bob.post('/api/notifications/settings', { group: 'your_projects', mode: 'weekly' }))
        .status
    ).toBe(200)
    expect(await setting('your_projects')).toBe('weekly')
    expect(
      (await bob.post('/api/notifications/settings', { group: 'your_projects', mode: 'instant' }))
        .status
    ).toBe(200)
    expect(await setting('your_projects')).toBeUndefined()
  })
  standard('a tampered link, or one for an always-emailed group, changes nothing', async () => {
    expect(
      (await anonymous().post('/api/notifications/stop', { t: `${bob.id}.money_to_you.forged` }))
        .status
    ).toBe(400)
    expect(
      (await anonymous().post('/api/notifications/stop', { t: stopToken(bob.id, 'records') }))
        .status
    ).toBe(400)
    expect(
      (
        await anonymous().post('/api/notifications/stop', {
          t: stopToken(bob.id, 'money_to_you', 'nope'),
        })
      ).status
    ).toBe(400)
    expect(await setting('money_to_you')).toBeUndefined()
  })
  standard('opening the link (GET) changes nothing', async () => {
    const t = stopToken(bob.id, 'money_to_you')
    expect((await anonymous().get(`/notifications/stop?t=${encodeURIComponent(t)}`)).status).toBe(
      200
    )
    expect(await setting('money_to_you')).toBeUndefined()
  })
})
