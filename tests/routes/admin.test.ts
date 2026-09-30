// Admin pages send nothing to anyone else: the admin layout alone doesn't stop a page from
// rendering and sending its data, so each page checks by itself (requireAdmin). Regression test
// for every admin page (private security note, 2026-09-30).
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, type Client } from '../helpers/http'
import { smoke, standard } from '../helpers/levels'

const PAGES = ['/admin/users', '/admin/transactions', '/admin/approvals', '/admin/projects', '/admin/tools', '/admin/comment-reports']
const emails = (html: string) => new Set(html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) ?? []).size

let bob: Client, rita: Client
beforeAll(async () => {
  ;[bob, rita] = await Promise.all([as('bob'), as('rita')])
})

describe('admin pages send their data to admins only', () => {
  for (const path of PAGES) {
    smoke(`${path}: nothing for visitors or signed-in non-admins`, async () => {
      for (const who of [anonymous(), bob]) {
        const r = await who.get(path)
        expect(emails(r.text)).toBeLessThan(3) // a contact address in the footer at most
        expect(r.text.length).toBeLessThan(150_000)
      }
    })
  }
  standard('an admin still gets the user list', async () => {
    const r = await rita.get('/admin/users')
    expect(r.status).toBe(200)
    expect(emails(r.text)).toBeGreaterThan(2)
  })
})
