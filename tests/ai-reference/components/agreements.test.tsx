// The grant agreement documents (docs/ai-reference/agreements), rendered to HTML the way the page, the stored copy and
// the emailed copy render them (utils/render-agreement.tsx). Made-up people and organizations only.
import { describe, expect, test } from 'bun:test'
import {
  agreementEmailHtml,
  renderIndividualAgreementHtml,
  renderOrgAgreementHtml,
} from '@/utils/render-agreement'
import { CURRENT_AGREEMENT_VERSION, CURRENT_ORG_AGREEMENT_VERSION } from '@/utils/constants'

const project = (fields: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    title: 'Current title',
    created_at: '2026-01-15T12:00:00Z',
    lobbying: false,
    approved: null,
    profiles: { full_name: 'Casey Creator', username: 'casey' },
    ...fields,
  }) as any

const signed = (fields: Record<string, unknown> = {}) =>
  ({
    signed_at: '2026-02-01T00:00:00Z',
    recipient_name: 'Name At Signing',
    project_title: 'Title at signing',
    lobbying_clause_excluded: false,
    version: CURRENT_AGREEMENT_VERSION,
    ...fields,
  }) as any

const org = {
  recipient_name: 'Example Foundation, Inc.',
  recipient_address: '1 Example Street, Springfield',
  recipient_country: 'United States',
  recipient_entity_class: 'us_501c3' as const,
  recipient_tax_id: '00-0000000',
  foreign_no_tin: false,
  signatory_name: 'Sam Signer',
}

const LOBBYING = 'To attempt to influence legislation'
const UNDECIDED = 'The Charity has not yet decided to give this grant'

describe('A2 two documents: an individual one and an organization one', () => {
  test('the current versions', () => {
    expect(CURRENT_AGREEMENT_VERSION).toBe(3)
    expect(CURRENT_ORG_AGREEMENT_VERSION).toBe(1)
  })
  test('the individual agreement names the creator as recipient', () => {
    const html = renderIndividualAgreementHtml({ project: project() })
    expect(html).toContain('Casey Creator (the “Recipient”)')
    expect(html).toContain('Current title')
  })
  test('the organization agreement names the organization, its address, country, kind and EIN', () => {
    const html = renderOrgAgreementHtml({ project: project(), values: org, excludeLobbyingClause: false })
    expect(html).toContain(
      'Example Foundation, Inc., 1 Example Street, Springfield, United States, a registered 501(c)(3) nonprofit with EIN 00-0000000 (the “Recipient”)'
    )
    expect(html).not.toContain('Casey Creator')
  })
  test('a non-US organization without an EIN is described without one', () => {
    const html = renderOrgAgreementHtml({
      project: project(),
      values: { ...org, recipient_entity_class: 'foreign_org', recipient_tax_id: null, foreign_no_tin: true },
      excludeLobbyingClause: false,
    })
    expect(html).toContain('a non-US organization (the “Recipient”)')
    expect(html).not.toContain('EIN 00')
  })
  test('a signed agreement keeps the version it was signed under', () => {
    const v1 = renderIndividualAgreementHtml({ project: project(), agreement: signed({ version: 1 }) })
    const v3 = renderIndividualAgreementHtml({ project: project(), agreement: signed({ version: 3 }) })
    expect(v1).toContain('The start date for your grant')
    expect(v3).toContain('The start date for this grant')
    expect(v1).toContain('>16<') // version 1 has one more section
    expect(v3).not.toContain('>16<')
  })
  test('an unsigned agreement shows the current version, whatever an earlier draft row says', () => {
    const html = renderIndividualAgreementHtml({ project: project(), agreement: signed({ signed_at: null, version: 1 }) })
    expect(html).toContain('The start date for this grant')
  })
})

describe('A3 the no-lobbying clause is left out for projects that declare lobbying', () => {
  test('individual: follows the project until signed', () => {
    expect(renderIndividualAgreementHtml({ project: project() })).toContain(LOBBYING)
    expect(renderIndividualAgreementHtml({ project: project({ lobbying: true }) })).not.toContain(LOBBYING)
  })
  test('individual: once signed, the choice made at signing stays, whatever the project says later', () => {
    const excluded = signed({ lobbying_clause_excluded: true })
    expect(renderIndividualAgreementHtml({ project: project({ lobbying: false }), agreement: excluded })).not.toContain(LOBBYING)
    const kept = signed({ lobbying_clause_excluded: false })
    expect(renderIndividualAgreementHtml({ project: project({ lobbying: true }), agreement: kept })).toContain(LOBBYING)
  })
  test('organization: as chosen by the caller (the project\'s lobbying flag at signing)', () => {
    expect(renderOrgAgreementHtml({ project: project(), values: org, excludeLobbyingClause: false })).toContain(LOBBYING)
    expect(renderOrgAgreementHtml({ project: project(), values: org, excludeLobbyingClause: true })).not.toContain(LOBBYING)
  })
})

describe('A4 a signed individual agreement shows what was recorded at signing', () => {
  test('signed: the recorded name and title', () => {
    const html = renderIndividualAgreementHtml({ project: project(), agreement: signed() })
    expect(html).toContain('Name At Signing (the “Recipient”)')
    expect(html).toContain('Title at signing')
    expect(html).not.toContain('Current title')
  })
  test('unsigned: the project\'s current name and title', () => {
    const html = renderIndividualAgreementHtml({ project: project(), agreement: signed({ signed_at: null }) })
    expect(html).toContain('Casey Creator (the “Recipient”)')
    expect(html).toContain('Current title')
  })
})

describe('A5 while there is no verdict, the document says the Charity hasn\'t decided yet', () => {
  test('individual and organization documents', () => {
    expect(renderIndividualAgreementHtml({ project: project({ approved: null }) })).toContain(UNDECIDED)
    expect(renderIndividualAgreementHtml({ project: project({ approved: true }) })).not.toContain(UNDECIDED)
    expect(renderOrgAgreementHtml({ project: project({ approved: null }), values: org, excludeLobbyingClause: false })).toContain(UNDECIDED)
    expect(renderOrgAgreementHtml({ project: project({ approved: true }), values: org, excludeLobbyingClause: false })).not.toContain(UNDECIDED)
  })
})

describe('A6 A19 the emailed copy: the document as rendered, then the signer\'s attestation', () => {
  test('the greeting and attestation are escaped; the document is included as rendered', () => {
    const documentHtml = renderOrgAgreementHtml({ project: project(), values: org, excludeLobbyingClause: false })
    const html = agreementEmailHtml({ greetingName: '<b>Sam</b>', documentHtml, attestation: 'I, Sam & co, agree' })
    expect(html).toContain('Dear &lt;b&gt;Sam&lt;/b&gt;,')
    expect(html).toContain(documentHtml)
    expect(html).toContain('I, Sam &amp; co, agree')
    expect(html.indexOf('Example Foundation')).toBeLessThan(html.indexOf('I, Sam'))
  })
  test('what a person typed in the details is escaped in the document', () => {
    const html = renderOrgAgreementHtml({
      project: project(),
      values: { ...org, recipient_name: '<script>x</script>' },
      excludeLobbyingClause: false,
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
