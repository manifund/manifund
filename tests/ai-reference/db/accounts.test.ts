// What the database does for accounts (docs/ai-reference/accounts/README.md): the profile made at sign-up, and what a
// ban's deletions take with them. Every test runs in a rolled-back transaction with accounts it creates itself
// (inserted into auth.users, as Supabase Auth does at sign-up). The sign-up webhook those inserts trigger is queued
// in the transaction and dropped with it, so nothing is sent.
import { describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { makeProject } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'

// A new account, as Supabase Auth creates it; returns its id.
async function signUp(tx: Tx, email: string, meta: Record<string, unknown> = {}): Promise<string> {
  const [row] = await tx`
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (gen_random_uuid(), ${email}, ${meta}, 'authenticated', 'authenticated')
    returning id`
  return row.id
}
const profile = async (tx: Tx, id: string) => (await tx`select * from profiles where id = ${id}`)[0]

// Email local parts unique to this run (RUN is like "test-<time><random>").
const tag = RUN.replace(/[^a-z0-9]/g, '')

describe('S7 every new account gets its profile at once', () => {
  test("username and name from the email's part before the @", () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `${tag}@local.test`)
      const p = await profile(tx, id)
      expect(p.username).toBe(tag)
      expect(p.full_name).toBe(tag)
    }))

  test('the username keeps only letters, digits, _ and -; the name keeps the part as typed', () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `${tag}.first+news@local.test`)
      const p = await profile(tx, id)
      expect(p.username).toBe(`${tag}firstnews`)
      expect(p.full_name).toBe(`${tag}.first+news`)
    }))

  test("Google's name is used as the name; the username still comes from the email", () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `${tag}g@local.test`, { full_name: 'Ada Lovelace' })
      const p = await profile(tx, id)
      expect(p.full_name).toBe('Ada Lovelace')
      expect(p.username).toBe(`${tag}g`)
    }))

  test('a taken username gets a number: 1, then 2', () =>
    inRollback(async (tx) => {
      const ids = [
        await signUp(tx, `${tag}@one.test`),
        await signUp(tx, `${tag}@two.test`),
        await signUp(tx, `${tag}@three.test`),
      ]
      const names = await Promise.all(ids.map(async (id) => (await profile(tx, id)).username))
      expect(names).toEqual([tag, `${tag}1`, `${tag}2`])
    }))

  test('nothing usable before the @: the account id is used for both', () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `+++@${tag}.test`)
      const p = await profile(tx, id)
      expect(p.username).toBe(id)
      expect(p.full_name).toBe('+++')
    }))
})

describe('S8 a new profile starts plain', () => {
  test('an individual, no bio, not a regrantor, not accredited', () =>
    inRollback(async (tx) => {
      const p = await profile(tx, await signUp(tx, `${tag}@local.test`))
      expect(p.type).toBe('individual')
      expect(p.bio).toBe('')
      expect(p.regranter_status).toBe(false)
      expect(p.accreditation_status).toBe(false)
    }))
})

describe('S9 browsers neither create nor delete profiles', () => {
  test('a signed-in person can create no profile, not even their own if it were missing', () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `${tag}@local.test`)
      await tx`delete from profiles where id = ${id}`
      await actAs(tx, id)
      await expect(
        (async () => await tx`insert into profiles (id, username, full_name) values (${id}, ${tag}, 'Me')`)()
      ).rejects.toThrow('row-level security')
    }))

  test('a visitor can create none', () =>
    inRollback(async (tx) => {
      await actAsAnon(tx)
      await expect(
        (async () =>
          await tx`insert into profiles (id, username, full_name) values (gen_random_uuid(), ${tag}, 'X')`)()
      ).rejects.toThrow('row-level security')
    }))

  test('a signed-in person deleting their own profile deletes nothing', () =>
    inRollback(async (tx) => {
      const id = await signUp(tx, `${tag}@local.test`)
      await actAs(tx, id)
      const deleted = await tx`delete from profiles where id = ${id} returning id`
      expect(deleted).toHaveLength(0)
      await tx`reset role`
      expect(await profile(tx, id)).toBeDefined()
    }))
})

// A ban's four steps as db/superban.ts runs them (the service-role client, which row-level security doesn't limit).
async function ban(tx: Tx, id: string) {
  await tx`delete from projects where creator = ${id}`
  await tx`delete from comments where commenter = ${id}`
  await tx`delete from profiles where id = ${id}`
  await tx`delete from auth.users where id = ${id}`
}
async function comment(tx: Tx, by: string, target: { project?: string; profile?: string }, replyingTo?: string) {
  const [row] = await tx`
    insert into comments (commenter, project, profile_id, content, replying_to)
    values (${by}, ${target.project ?? null}, ${target.profile ?? null}, ${doc('test')}, ${replyingTo ?? null})
    returning id`
  return row.id as string
}
const count = async (tx: Tx, q: Promise<any[]>) => (await q).length

describe('S17 what a ban deletes', () => {
  test('their projects, comments everywhere with the replies to them, their profile and its rows, the account', () =>
    inRollback(async (tx) => {
      const banned = await signUp(tx, `${tag}-banned@local.test`)
      const other = await signUp(tx, `${tag}-other@local.test`)
      const theirs = await makeProject(tx, banned, 'active', `${RUN}-banned`)
      const elsewhere = await makeProject(tx, other, 'active', `${RUN}-other`)
      // On their own project: a comment by someone else, a follow and a vote by someone else.
      await comment(tx, other, { project: theirs.id })
      await tx`insert into project_follows (project_id, follower_id) values (${theirs.id}, ${other})`
      // Elsewhere: their comment, someone's reply to it, their follow and their vote.
      const theirComment = await comment(tx, banned, { project: elsewhere.id })
      const reply = await comment(tx, other, { project: elsewhere.id }, theirComment)
      const kept = await comment(tx, other, { project: elsewhere.id })
      await tx`insert into project_follows (project_id, follower_id) values (${elsewhere.id}, ${banned})`
      await tx`insert into project_votes (project_id, voter_id, magnitude) values (${elsewhere.id}, ${banned}, 1)`
      // On their profile: someone's comment.
      await comment(tx, other, { profile: banned })

      await ban(tx, banned)

      expect(await count(tx, tx`select 1 from projects where id = ${theirs.id}`)).toBe(0)
      expect(await count(tx, tx`select 1 from comments where project = ${theirs.id}`)).toBe(0)
      expect(await count(tx, tx`select 1 from comments where id in (${theirComment}, ${reply})`)).toBe(0)
      expect(await count(tx, tx`select 1 from comments where id = ${kept}`)).toBe(1)
      expect(await count(tx, tx`select 1 from comments where profile_id = ${banned}`)).toBe(0)
      expect(await count(tx, tx`select 1 from project_follows where follower_id = ${banned} or project_id = ${theirs.id}`)).toBe(0)
      expect(await count(tx, tx`select 1 from project_votes where voter_id = ${banned}`)).toBe(0)
      expect(await count(tx, tx`select 1 from profiles where id = ${banned}`)).toBe(0)
      expect(await count(tx, tx`select 1 from auth.users where id = ${banned}`)).toBe(0)
      // The other person and their project stay.
      expect(await count(tx, tx`select 1 from projects where id = ${elsewhere.id}`)).toBe(1)
      expect(await profile(tx, other)).toBeDefined()
    }))

  test('the email is free again: a new account with it gets a new profile', () =>
    inRollback(async (tx) => {
      const email = `${tag}-again@local.test`
      const first = await signUp(tx, email)
      await ban(tx, first)
      const second = await signUp(tx, email)
      expect(second).not.toBe(first)
      expect((await profile(tx, second)).username).toBe(`${tag}-again`)
    }))
})
