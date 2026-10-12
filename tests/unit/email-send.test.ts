// The email helpers (utils/email.ts) read Postmark's answer: a refused or failed send is returned as `ok: false` and
// logged as `email.failed` without the address.
// fetch is replaced here: nothing reaches Postmark.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  postmarkResult,
  sendBatchEmail,
  sendEmail,
  sendTemplateEmail,
  TEMPLATE_IDS,
} from '@/utils/email'

const realFetch = globalThis.fetch
const realError = console.error
let answers: Array<{ status: number; body: unknown } | Error>
let errors: string[]

beforeEach(() => {
  errors = []
  console.error = (line: string) => void errors.push(String(line))
  globalThis.fetch = (async () => {
    const next = answers.shift()!
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next.body), { status: next.status })
  }) as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
  console.error = realError
})

const OK = { ErrorCode: 0, Message: 'OK', MessageID: 'm1' }
const INACTIVE = {
  ErrorCode: 406,
  Message: 'You tried to send to recipient(s) that have been marked as inactive.',
}

describe('postmarkResult', () => {
  test('2xx with ErrorCode 0 is accepted', () => {
    expect(postmarkResult(200, OK)).toEqual({ ok: true, messageId: 'm1' })
  })
  test('an error status, a non-zero ErrorCode or no answer is a failure', () => {
    expect(postmarkResult(422, INACTIVE)).toEqual({
      ok: false,
      status: 422,
      errorCode: 406,
      message: INACTIVE.Message,
    })
    expect(postmarkResult(200, { ErrorCode: 300, Message: 'Invalid email' }).ok).toBe(false)
    expect(postmarkResult(500, null)).toEqual({
      ok: false,
      status: 500,
      errorCode: undefined,
      message: 'HTTP 500',
    })
  })
})

describe('sendTemplateEmail', () => {
  test('accepted: ok, nothing logged', async () => {
    answers = [{ status: 200, body: OK }]
    expect(
      await sendTemplateEmail(TEMPLATE_IDS.VERDICT, {}, undefined, 'someone@example.org')
    ).toEqual({ ok: true, messageId: 'm1' })
    expect(errors).toHaveLength(0)
  })
  test('refused: the failure is returned and logged with the template and ids, not the address', async () => {
    answers = [{ status: 422, body: INACTIVE }]
    const r = await sendTemplateEmail(
      TEMPLATE_IDS.NEW_USER_GRANT,
      {},
      undefined,
      'someone@example.org',
      undefined,
      { project_id: 'p1' }
    )
    expect(r).toMatchObject({ ok: false, status: 422, errorCode: 406 })
    expect(errors).toHaveLength(1)
    const line = JSON.parse(errors[0])
    expect(line).toMatchObject({
      level: 'error',
      event: 'email.failed',
      template: 'NEW_USER_GRANT',
      project_id: 'p1',
      error_code: 406,
      to_domain: 'example.org',
    })
    expect(errors[0]).not.toContain('someone')
  })
  test('Postmark unreachable: a failure, not a thrown error', async () => {
    answers = [new TypeError('fetch failed')]
    const r = await sendTemplateEmail(TEMPLATE_IDS.VERDICT, {}, undefined, 'someone@example.org')
    expect(r).toEqual({ ok: false, message: 'postmark unreachable: fetch failed' })
    expect(errors).toHaveLength(1)
  })
})

describe('sendEmail', () => {
  test('refused: returned and logged', async () => {
    answers = [{ status: 401, body: { ErrorCode: 10, Message: 'Bad or missing API token' } }]
    expect(await sendEmail('a@example.org', 'Hi', '<p>x</p>', 'x')).toMatchObject({
      ok: false,
      errorCode: 10,
    })
    expect(JSON.parse(errors[0]).event).toBe('email.failed')
  })
})

describe('sendBatchEmail', () => {
  const mail = (to: string) => ({ toEmail: to, subject: 'S', htmlBody: 'h', textBody: 't' })
  test('every message accepted: ok', async () => {
    answers = [{ status: 200, body: [OK, OK] }]
    expect(await sendBatchEmail([mail('a@x.org'), mail('b@x.org')])).toEqual({
      ok: true,
      failed: 0,
    })
  })
  test('one refused in the batch: counted and logged once', async () => {
    answers = [{ status: 200, body: [OK, INACTIVE] }]
    expect(await sendBatchEmail([mail('a@x.org'), mail('b@y.org')])).toMatchObject({
      ok: false,
      failed: 1,
    })
    expect(errors).toHaveLength(1)
    expect(JSON.parse(errors[0])).toMatchObject({ index: 1, to_domain: 'y.org' })
  })
  test('the whole batch refused (one error object): all failed', async () => {
    answers = [{ status: 401, body: { ErrorCode: 10, Message: 'Bad token' } }]
    expect(await sendBatchEmail([mail('a@x.org'), mail('b@x.org')])).toMatchObject({
      ok: false,
      failed: 2,
      errorCode: 10,
    })
  })
})
