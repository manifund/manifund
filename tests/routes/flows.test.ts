// Comments posted by other flows: giving a grant, an admin verdict, closing a project.
// alice is a regrantor in the local data; rita is an admin in development.
import { beforeAll, describe, expect } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, makeProject, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { slow, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
})

describe('C26 C27 C23 a grant with its rationale, then a verdict with a note', () => {
  slow('the rationale and the note are comments; the creator gets in-app notifications, no extra email', async () => {
    const [regrantor] = await sql`select regranter_status from profiles where id = ${alice.id}`
    if (!regrantor?.regranter_status) throw new Error('alice must be a regrantor locally (profiles.regranter_status)')
    const r = await alice.post('/api/create-grant', {
      title: `Grant for bob ${RUN}`,
      subtitle: 'test',
      description: doc('What bob will do'),
      donorNotes: doc(`Why I fund bob ${RUN}`),
      donorContribution: 0,
      fundingGoal: 1000,
      minFunding: 100,
      recipientUsername: 'bob',
      causeSlugs: [],
      locationDescription: '',
      lobbying: false,
    })
    expect(r.status).toBe(200)
    expect(r.body.rationaleError).toBeUndefined()
    const projectId = r.body.id as string
    const [rationale] = await sql`select id, commenter, special_type from comments where project = ${projectId}`
    expect(rationale.special_type).toBe('grant rationale')
    expect(rationale.commenter).toBe(alice.id)
    const [n] = await sql`select reason, email_status from notifications where comment_id = ${rationale.id} and recipient_id = ${bob.id}`
    expect(n.reason).toBe('comment_on_your_project')
    expect(n.email_status).toBe('skipped') // covered by the grant email (C23)

    const verdict = await rita.post('/api/issue-grant-verdict', {
      approved: false,
      projectId,
      adminComment: doc(`Out of scope for this round ${RUN}`),
      publicBenefit: '',
    })
    expect(verdict.status).toBe(200)
    const types = (await sql`select special_type from comments where project = ${projectId} order by created_at`).map(
      (c: any) => c.special_type
    )
    expect(types).toEqual(['grant rationale', 'admin note'])
    const [project] = await sql`select stage from projects where id = ${projectId}`
    expect(project.stage).toBe('not funded')
  })
})

describe('C28 closing a project with its final report', () => {
  standard('only the creator; the report is saved, then the project completes', async () => {
    const project = await makeProject(sql, alice.id, 'active', `${RUN}-closing`)
    const body = { projectId: project.id, reportContent: doc(`We did it ${RUN}`) }
    expect((await bob.post('/api/close-active-project', body)).status).toBe(403)
    expect((await alice.post('/api/close-active-project', { ...body, reportContent: doc(' ') })).status).toBe(400)
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe('active')
    expect((await alice.post('/api/close-active-project', body)).status).toBe(200)
    expect((await sql`select stage from projects where id = ${project.id}`)[0].stage).toBe('complete')
    const [report] = await sql`select special_type from comments where project = ${project.id}`
    expect(report.special_type).toBe('final report')
  })
})
