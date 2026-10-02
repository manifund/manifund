import { describe, expect, test } from 'bun:test'
import { emailFor } from '@/lib/notifications/templates'
import { TEMPLATE_IDS } from '@/utils/email'
import { doc } from '../helpers/content'

const base = {
  content: doc('A <b>bold</b> claim'),
  commenter: { username: 'maya', avatar_url: null },
  target: { title: 'Better <evals>', url: 'https://manifund.org/projects/x?tab=comments#c1' },
}

describe('C22 notification emails', () => {
  test('comments and replies use the new-comment email, mentions their own', () => {
    expect(emailFor({ ...base, reason: 'comment_on_your_project' }).templateId).toBe(TEMPLATE_IDS.NEW_COMMENT)
    expect(emailFor({ ...base, reason: 'reply_to_you' }).templateId).toBe(TEMPLATE_IDS.NEW_COMMENT)
    expect(emailFor({ ...base, reason: 'mention' }).templateId).toBe(TEMPLATE_IDS.COMMENT_WITH_MENTION)
  })
  test('progress updates and final reports say what they are', () => {
    const e = emailFor({ ...base, reason: 'progress_update' })
    expect(e.templateId).toBe(TEMPLATE_IDS.GENERIC_NOTIF_HTML)
    expect(String(e.model.subject)).toContain('Update posted')
    expect(String(emailFor({ ...base, reason: 'final_report' }).model.subject)).toContain('Final report')
  })
  test('titles are escaped in hand-built email HTML', () => {
    const html = String(emailFor({ ...base, reason: 'progress_update' }).model.htmlContent)
    expect(html).toContain('Better &lt;evals&gt;')
    expect(html).not.toContain('<evals>')
  })
})
