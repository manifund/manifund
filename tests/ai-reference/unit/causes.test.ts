// Causes (docs/ai-reference/causes): saving a project's causes (db/cause.ts updateProjectCauses), with a stand-in for the
// Supabase client that records what it's asked to do.
import { describe, expect, test } from 'bun:test'
import { updateProjectCauses } from '@/db/cause'

function recorder() {
  const calls: { table: string; op: string; arg: unknown }[] = []
  const done = { throwOnError: async () => ({ error: null }) }
  const client = {
    from: (table: string) => ({
      delete: () => ({
        eq: (column: string, value: unknown) => {
          calls.push({ table, op: 'delete', arg: { [column]: value } })
          return done
        },
      }),
      insert: (rows: unknown) => {
        calls.push({ table, op: 'insert', arg: rows })
        return done
      },
    }),
  }
  return { client: client as any, calls }
}

describe("R10 saving a project's causes replaces its whole list; a cause sent twice is saved once", () => {
  test('the old links are removed, then the new list is written', async () => {
    const { client, calls } = recorder()
    await updateProjectCauses(client, ['tais', 'ai-gov'], 'project-1')
    expect(calls).toEqual([
      { table: 'project_causes', op: 'delete', arg: { project_id: 'project-1' } },
      {
        table: 'project_causes',
        op: 'insert',
        arg: [
          { project_id: 'project-1', cause_slug: 'tais' },
          { project_id: 'project-1', cause_slug: 'ai-gov' },
        ],
      },
    ])
  })
  test('duplicates (a program also sent as a topic) are saved once', async () => {
    const { client, calls } = recorder()
    await updateProjectCauses(client, ['tais', 'falcon-fund', 'tais'], 'project-1')
    expect(calls[1].arg).toEqual([
      { project_id: 'project-1', cause_slug: 'tais' },
      { project_id: 'project-1', cause_slug: 'falcon-fund' },
    ])
  })
  test('an empty list removes every cause', async () => {
    const { client, calls } = recorder()
    await updateProjectCauses(client, [], 'project-1')
    expect(calls.map((c) => c.op)).toEqual(['delete', 'insert'])
    expect(calls[1].arg).toEqual([])
  })
})
