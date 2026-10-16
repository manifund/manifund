// Profiles' rules the database keeps (docs/ai-reference/people/README.md), checked as visitors and signed-in people.
// Only throwaway profiles made inside the test's transaction, always rolled back.
import { describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'

// A throwaway profile, as the sign-up trigger would make it (no auth user needed).
const tag = () => `u${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
async function makeProfile(tx: Tx, fields: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  const username = (fields.username as string) ?? tag()
  await tx`insert into profiles (id, username, full_name, bio) values (${id}, ${username}, ${'Test ' + username}, 'before')`
  return { id, username }
}
// Bun's tagged queries are lazy: they run only once awaited, and expect(...).rejects doesn't start them (the query
// would then wait in the transaction and block its rollback). Start it inside an async function.
const run = (query: PromiseLike<unknown>) => (async () => await query)()
// A sign-up: the auth user row fires the profile trigger (and, locally, a webhook that the rollback drops).
async function signUp(tx: Tx, email: string, meta: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  await tx`insert into auth.users (id, email, raw_user_meta_data) values (${id}, ${email}, ${meta})`
  const [p] = await tx`select username, full_name from profiles where id = ${id}`
  return p as { username: string; full_name: string }
}

describe('U1 every profile is public', () => {
  test('visitors and signed-in people read any profile', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const bob = await makeProfile(tx)
      await actAsAnon(tx)
      expect((await tx`select username from profiles where id = ${ann.id}`) as unknown[]).toEqual([{ username: ann.username }])
      await tx`reset role`
      await actAs(tx, bob.id)
      expect((await tx`select username from profiles where id = ${ann.id}`) as unknown[]).toEqual([{ username: ann.username }])
    }))
})

describe('U2 signing up creates the profile, named from the email or the Google name', () => {
  test('username: the email local part with only letters, digits, _ and - kept; name: the local part', () =>
    inRollback(async (tx) => {
      const t = tag()
      const p = await signUp(tx, `${t}.a+b_c-d@example.test`)
      expect(p.username).toBe(`${t}ab_c-d`)
      expect(p.full_name).toBe(`${t}.a+b_c-d`)
    }))
  test('a taken username gets a number', () =>
    inRollback(async (tx) => {
      const t = tag()
      await makeProfile(tx, { username: t })
      expect((await signUp(tx, `${t}@example.test`)).username).toBe(`${t}1`)
      expect((await signUp(tx, `${t}@other.test`)).username).toBe(`${t}2`)
    }))
  test("the name is the Google account's full name when there is one", () =>
    inRollback(async (tx) => {
      const t = tag()
      const p = await signUp(tx, `${t}@example.test`, { full_name: 'Ann Lee' })
      expect(p.full_name).toBe('Ann Lee')
      expect(p.username).toBe(t)
    }))
})

describe('U3 usernames are unique, exactly as typed', () => {
  test('a second profile with the same username is refused', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await expect(makeProfile(tx, { username: ann.username })).rejects.toThrow(/profiles_username_key|duplicate/)
    }))
  test('a different case is a different username', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await makeProfile(tx, { username: ann.username.toUpperCase() })
      expect(await tx`select 1 from profiles where lower(username) = ${ann.username}`).toHaveLength(2)
    }))
})

describe('U4 others don\'t change someone\'s profile; nobody adds or deletes one', () => {
  test('a person changes their own profile', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAs(tx, ann.id)
      expect(await tx`update profiles set bio = 'after' where id = ${ann.id} returning id`).toHaveLength(1)
    }))
  test("another signed-in person changes nothing on it", () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const bob = await makeProfile(tx)
      await actAs(tx, bob.id)
      expect(await tx`update profiles set bio = 'after' where id = ${ann.id} returning id`).toHaveLength(0)
      await tx`reset role`
      expect((await tx`select bio from profiles where id = ${ann.id}`) as unknown[]).toEqual([{ bio: 'before' }])
    }))
  test('a visitor changes no profile', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAsAnon(tx)
      expect(await tx`update profiles set bio = 'after' where id = ${ann.id} returning id`).toHaveLength(0)
    }))
  test('nobody deletes a profile, even their own', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAs(tx, ann.id)
      expect(await tx`delete from profiles where id = ${ann.id} returning id`).toHaveLength(0)
    }))
  test('nobody adds a profile', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAs(tx, ann.id)
      const id = crypto.randomUUID()
      await expect(run(tx`insert into profiles (id, username) values (${id}, ${tag()})`)).rejects.toThrow('row-level security')
    }))
})

describe('U5 avatars are public; people upload only into their own folder', () => {
  test('into their own folder: allowed, and anyone reads it', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAs(tx, ann.id)
      await tx`insert into storage.objects (bucket_id, name) values ('avatars', ${ann.id + '/a'})`
      await tx`reset role`
      await actAsAnon(tx)
      expect(await tx`select 1 from storage.objects where bucket_id = 'avatars' and name = ${ann.id + '/a'}`).toHaveLength(1)
    }))
  test("into someone else's folder: refused", () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      const bob = await makeProfile(tx)
      await actAs(tx, bob.id)
      await expect(run(tx`insert into storage.objects (bucket_id, name) values ('avatars', ${ann.id + '/a'})`)).rejects.toThrow(
        'row-level security'
      )
    }))
  test('a visitor uploads nothing', () =>
    inRollback(async (tx) => {
      const ann = await makeProfile(tx)
      await actAsAnon(tx)
      await expect(run(tx`insert into storage.objects (bucket_id, name) values ('avatars', ${ann.id + '/a'})`)).rejects.toThrow(
        'row-level security'
      )
    }))
})
