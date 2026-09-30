// A few flows clicked through in a real browser (Chromium). Each test names the rules it shows.
import { expect, test } from '@playwright/test'
import { api, doc, person, RUN, signIn, world } from './support'

const editor = (scope: import('@playwright/test').Locator) => scope.locator('.ProseMirror[contenteditable="true"]').first()

test('C3 C11 post a comment and reply to it', async ({ page, context }) => {
  const w = await world()
  await signIn(context, 'bob')
  await page.goto(`/projects/${w.project.slug}?tab=comments`)
  const box = page.locator('#main-write-comment')
  await editor(box).click()
  await page.keyboard.type(`How will you measure success? ${RUN}`)
  await box.locator('button').last().click()
  await expect(page.getByText(`How will you measure success? ${RUN}`)).toBeVisible()
})

test('C12 edit a comment; the history shows every version', async ({ page, context }) => {
  const w = await world()
  const c = await api('bob', '/api/comments', 'POST', { target: { project: w.project.id }, content: doc(`First take ${RUN}`) })
  await signIn(context, 'bob')
  await page.goto(`/projects/${w.project.slug}?tab=comments#${c.body.comment.id}`)
  const card = page.locator(`[id="${c.body.comment.id}"]`)
  await card.getByRole('button', { name: 'Edit', exact: true }).click()
  const ed = editor(card)
  await ed.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(`Second take ${RUN}`)
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByText(`Second take ${RUN}`)).toBeVisible()
  await card.getByRole('button', { name: 'edited' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(`First take ${RUN}`)).toBeVisible()
  await expect(dialog.getByText('Original')).toBeVisible()
})

test('C16 a removed comment shows the moderator\'s reason to visitors', async ({ page }) => {
  const w = await world()
  const c = await api('bob', '/api/comments', 'POST', { target: { project: w.project.id }, content: doc(`My address is 1 Example St ${RUN}`) })
  expect((await api('rita', `/api/comments/${c.body.comment.id}`, 'DELETE', { reason: 'private information' })).status).toBe(200)
  await page.goto(`/projects/${w.project.slug}?tab=comments`)
  await expect(page.getByText('Removed by a moderator: private information')).toBeVisible()
  await expect(page.getByText('1 Example St')).toHaveCount(0)
})

test('C8 a profile: visitors see the guidelines; the person can reply but not start a thread', async ({ page, context }) => {
  const alice = await person('alice')
  await api('bob', '/api/comments', 'POST', { target: { profile_id: alice.id }, content: doc(`Great collaborator ${RUN}`) })
  await page.goto('/alice')
  await expect(page.getByText('Commenting guidelines')).toBeVisible()
  await expect(page.getByText(`Great collaborator ${RUN}`)).toBeVisible()
  await signIn(context, 'alice')
  await page.goto('/alice')
  await expect(page.locator('#comments-on-profile #main-write-comment')).toHaveCount(0)
})

test('C2 a program shows comments under About', async ({ page }) => {
  const w = await world()
  await api('bob', '/api/comments', 'POST', { target: { cause_slug: w.program }, content: doc(`Does my project fit? ${RUN}`) })
  await page.goto(`/causes/${w.program}?tab=about`)
  await expect(page.getByText(/Comments on/)).toBeVisible()
  await expect(page.getByText(`Does my project fit? ${RUN}`)).toBeVisible()
})

test('C10 a refused comment keeps its text', async ({ page, context }) => {
  const w = await world()
  await signIn(context, 'bob')
  await page.goto(`/projects/${w.project.slug}?tab=comments`)
  const box = page.locator('#main-write-comment')
  const long = Array.from({ length: 2100 }, (_, i) => `w${i}`).join(' ')
  await editor(box).fill(`${long} ${RUN}`)
  await box.locator('button').last().click()
  await expect(page.getByText(/limited to 2,000 words/)).toBeVisible()
  await expect(editor(box)).toContainText(RUN)
})

test('C25 notifications list new comments', async ({ page, context }) => {
  const w = await world()
  await api('bob', '/api/comments', 'POST', { target: { project: w.project.id }, content: doc(`Ping for the creator ${RUN}`) })
  await signIn(context, 'alice')
  await page.goto('/notifications')
  await expect(page.getByText('commented on your project').first()).toBeVisible()
})
