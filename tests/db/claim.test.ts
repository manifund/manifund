// C24: the email sent right after a comment and the backup sweep never claim the same notification.
// Needs committed rows (two transactions can't see each other's uncommitted rows), so this file
// creates its own project and deletes it afterwards.
import { afterAll, beforeAll, describe, expect } from 'bun:test'
import { sql, insertComment } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { RUN } from '../helpers/content'
import { standard } from '../helpers/levels'

let p: People
let projectId: string
let commentId: string

beforeAll(async () => {
  p = await getPeople()
  projectId = (await makeProject(sql, p.alice.id, 'active', `${RUN}-claim`)).id
  commentId = await sql.begin((tx) => insertComment(tx, { by: p.bob.id, project: projectId }))
})
afterAll(async () => {
  await sql`delete from projects where id = ${projectId}` // cascades to comments and notifications
})

const pending = async () => {
  await sql`delete from notifications where comment_id = ${commentId}`
  await sql`insert into notifications (recipient_id, reason, comment_id, actor_id) values
              (${p.alice.id}, 'comment_on_your_project', ${commentId}, ${p.bob.id}),
              (${p.rita.id}, 'followed_project_comment', ${commentId}, ${p.bob.id}),
              (${p.bob.id}, 'mention', ${commentId}, ${p.alice.id})`
}
class Done extends Error {}

describe('C24 two senders never email the same notification', () => {
  standard('while one sender holds its claim, the other gets only the rest', async () => {
    await pending()
    let releaseFirst!: () => void
    const firstMayFinish = new Promise<void>((r) => (releaseFirst = r))
    let firstClaimed!: (ids: string[]) => void
    const firstHasClaimed = new Promise<string[]>((r) => (firstClaimed = r))

    const first = sql
      .begin(async (tx) => {
        const rows = await tx`select id from claim_notification_emails(${commentId}, '0 seconds', 2)`
        firstClaimed(rows.map((r: any) => r.id))
        await firstMayFinish // keep the rows locked
        throw new Done()
      })
      .catch((e) => {
        if (!(e instanceof Done)) throw e
      })

    const a = await firstHasClaimed
    const b = await sql
      .begin(async (tx) => {
        const rows = await tx`select id from claim_notification_emails(${commentId}, '0 seconds', 50)`
        throw Object.assign(new Done(), { ids: rows.map((r: any) => r.id) })
      })
      .catch((e) => (e as any).ids as string[])
    releaseFirst()
    await first

    expect(a).toHaveLength(2)
    expect(b).toHaveLength(1)
    expect(a).not.toContain(b[0])
  })

  standard('a claim stuck for over 10 minutes (a sender that died) is picked up again', async () => {
    await pending()
    await sql`update notifications set email_status = 'sending', email_claimed_at = now() - interval '11 minutes'
              where comment_id = ${commentId} and recipient_id = ${p.alice.id}`
    await sql`update notifications set email_status = 'sending', email_claimed_at = now() - interval '1 minute'
              where comment_id = ${commentId} and recipient_id = ${p.rita.id}`
    await sql`update notifications set email_status = 'sent' where comment_id = ${commentId} and recipient_id = ${p.bob.id}`
    const claimed = await sql.begin(async (tx) => {
      const rows = await tx`select recipient_id from claim_notification_emails(${commentId}, '0 seconds', 50)`
      throw Object.assign(new Done(), { ids: rows.map((r: any) => r.recipient_id) })
    }).catch((e) => (e as any).ids as string[])
    expect(claimed).toEqual([p.alice.id])
  })
})
