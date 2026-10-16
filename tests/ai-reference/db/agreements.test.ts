// Grant agreements (docs/ai-reference/agreements): who can read and write the two agreement tables, the database's own
// checks, and the countersignature an approval writes. Every test runs in a rolled-back transaction, on projects and
// agreements it creates (made-up details only).
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// A proposal by alice with a signed individual agreement and its private row, written as the server does.
async function signedProposal(tx: Tx, slug = `${RUN}-agreement`) {
  const project = await makeProject(tx, p.alice.id, 'proposal', slug)
  await tx`update projects set signed_agreement = true where id = ${project.id}`
  await tx`insert into grant_agreements (project_id, signed_at, recipient_name, signatory_name, project_title, version)
           values (${project.id}, now(), 'Test Recipient', 'Test Recipient', ${'Test project ' + RUN}, 3)`
  await tx`insert into grant_agreement_private (project_id, signatory_email, signed_ip, signed_user_agent)
           values (${project.id}, ${`${RUN}-signer@example.test`}, '203.0.113.5', 'test-agent')`
  return project
}

// Bun's tagged queries only run when awaited: wrap them so expect(...).rejects runs them.
const attempt = (fn: () => Promise<unknown>) => (async () => await fn())()

const verdict = async (tx: Tx, approved: boolean, projectId: string, adminId: string) =>
  await tx`select execute_grant_verdict_v2(${approved}, ${projectId}::uuid, ${adminId}::uuid, 'Test benefit')`

describe('A20 only the server writes the agreement', () => {
  for (const who of ['the creator', 'someone else', 'a visitor'] as const) {
    test(`${who} can't create, change or delete an agreement through the database`, () =>
      inRollback(async (tx) => {
        const project = await signedProposal(tx)
        const other = await makeProject(tx, p.alice.id, 'proposal', `${RUN}-unsigned`)
        const as = async () => {
          if (who === 'a visitor') await actAsAnon(tx)
          else await actAs(tx, who === 'the creator' ? p.alice.id : p.bob.id)
        }
        await tx`savepoint s`
        await as()
        await expect(
          attempt(() => tx`insert into grant_agreements (project_id, signed_at) values (${other.id}, now())`)
        ).rejects.toThrow('row-level security')
        await tx`rollback to savepoint s`
        await as()
        const updated = await tx`update grant_agreements set recipient_name = 'Someone else', approved_at = now()
                                 where project_id = ${project.id} returning 1`
        expect(updated).toHaveLength(0)
        const deleted = await tx`delete from grant_agreements where project_id = ${project.id} returning 1`
        expect(deleted).toHaveLength(0)
        await tx`reset role`
        const [row] = await tx`select recipient_name, approved_at from grant_agreements where project_id = ${project.id}`
        expect(row).toEqual({ recipient_name: 'Test Recipient', approved_at: null })
        expect(await tx`select 1 from grant_agreements where project_id = ${other.id}`).toHaveLength(0)
      }))
  }
})

describe('A21 signing evidence and tax records: browsers can neither read nor write them', () => {
  for (const who of ['the creator', 'someone else', 'a visitor'] as const) {
    test(`${who} sees nothing and changes nothing`, () =>
      inRollback(async (tx) => {
        const project = await signedProposal(tx)
        const other = await makeProject(tx, p.alice.id, 'proposal', `${RUN}-unsigned`)
        const as = async () => {
          if (who === 'a visitor') await actAsAnon(tx)
          else await actAs(tx, who === 'the creator' ? p.alice.id : p.bob.id)
        }
        await as()
        expect(await tx`select * from grant_agreement_private where project_id = ${project.id}`).toHaveLength(0)
        const updated = await tx`update grant_agreement_private set w9_received_at = now(), signing_token_hash = 'x'
                                 where project_id = ${project.id} returning 1`
        expect(updated).toHaveLength(0)
        expect(await tx`delete from grant_agreement_private where project_id = ${project.id} returning 1`).toHaveLength(0)
        await tx`savepoint s`
        await expect(
          attempt(() => tx`insert into grant_agreement_private (project_id, signing_token_hash) values (${other.id}, 'x')`)
        ).rejects.toThrow('row-level security')
        await tx`rollback to savepoint s`
        await tx`reset role`
        const [row] = await tx`select w9_received_at, signing_token_hash, signatory_email from grant_agreement_private
                               where project_id = ${project.id}`
        expect(row).toEqual({ w9_received_at: null, signing_token_hash: null, signatory_email: `${RUN}-signer@example.test` })
      }))
  }
})

describe('A16 a signing link\'s hash belongs to one agreement', () => {
  test('two agreements can\'t hold the same token hash', () =>
    inRollback(async (tx) => {
      const a = await signedProposal(tx, `${RUN}-a`)
      const b = await signedProposal(tx, `${RUN}-b`)
      await tx`update grant_agreement_private set signing_token_hash = ${RUN + '-hash'} where project_id = ${a.id}`
      await expect(
        attempt(() => tx`update grant_agreement_private set signing_token_hash = ${RUN + '-hash'} where project_id = ${b.id}`)
      ).rejects.toThrow('grant_agreement_private_signing_token_hash_idx')
    }))
})

describe('A2 A9 the database accepts only the known kinds of recipient and entity', () => {
  for (const [column, value] of [['recipient_type', 'company'], ['recipient_entity_class', 'individual']] as const) {
    test(`${column} = '${value}' is refused`, () =>
      inRollback(async (tx) => {
        const project = await signedProposal(tx)
        await expect(
          attempt(() => tx.unsafe(`update grant_agreements set ${column} = $1 where project_id = $2`, [value, project.id]))
        ).rejects.toThrow(`grant_agreements_${column}_check`)
      }))
  }
  test('a new agreement is an individual one by default', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id, 'proposal', `${RUN}-default`)
      const [row] = await tx`insert into grant_agreements (project_id) values (${project.id})
                             returning recipient_type, foreign_no_tin, signatory_authority_attested`
      expect(row).toEqual({ recipient_type: 'individual', foreign_no_tin: false, signatory_authority_attested: false })
    }))
})

describe('A22 the countersignature is the approval, on that project\'s agreement only', () => {
  test('approving records the admin and the date on its agreement; other agreements are untouched', () =>
    inRollback(async (tx) => {
      const project = await signedProposal(tx, `${RUN}-approved`)
      const other = await signedProposal(tx, `${RUN}-other`)
      await verdict(tx, true, project.id, p.rita.id)
      const [row] = await tx`select approved_by, approved_at > now() - interval '1 minute' as recent
                             from grant_agreements where project_id = ${project.id}`
      expect(row).toEqual({ approved_by: p.rita.id, recent: true })
      const [untouched] = await tx`select approved_by, approved_at from grant_agreements where project_id = ${other.id}`
      expect(untouched).toEqual({ approved_by: null, approved_at: null })
    }))
  test('rejecting records no countersignature', () =>
    inRollback(async (tx) => {
      const project = await signedProposal(tx)
      await verdict(tx, false, project.id, p.rita.id)
      const [row] = await tx`select approved_by, approved_at from grant_agreements where project_id = ${project.id}`
      expect(row).toEqual({ approved_by: null, approved_at: null })
    }))

})

describe('A20 A21 an agreement goes with its project', () => {
  test('deleting a project deletes its agreement and private record', () =>
    inRollback(async (tx) => {
      const project = await signedProposal(tx)
      await tx`delete from projects where id = ${project.id}`
      expect(await tx`select 1 from grant_agreements where project_id = ${project.id}`).toHaveLength(0)
      expect(await tx`select 1 from grant_agreement_private where project_id = ${project.id}`).toHaveLength(0)
    }))
})
