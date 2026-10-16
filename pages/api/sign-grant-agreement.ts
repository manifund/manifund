import { getProjectAndProfileById } from '@/db/project'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import { CURRENT_AGREEMENT_VERSION, CURRENT_ORG_AGREEMENT_VERSION } from '@/utils/constants'
import { clientIp, commitSignature } from '@/utils/grant-agreement-write'
import {
  agreementEmailHtml,
  renderIndividualAgreementHtml,
  renderOrgAgreementHtml,
} from '@/utils/render-agreement'
import { parseOrgValues, type GrantAgreement } from '@/db/grant_agreement'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

// Signing by the project creator: either personally, or as an authorized
// representative of a recipient organization. When the organization's signatory
// is someone else, the creator never lands here — see
// send-agreement-for-signature.ts and sign-grant-agreement-external.ts.
export default async function handler(req: NextRequest) {
  const { projectId, recipientType, values, authorityAttested } = await req.json()
  const { supabase, user } = await getUserAndClient(req)
  const project = await getProjectAndProfileById(supabase, projectId)
  if (!project || user?.id !== project.creator) {
    return Response.error()
  }

  const isOrg = recipientType === 'organization'
  const parsed = isOrg ? parseOrgValues(values) : null
  if (parsed && 'error' in parsed) {
    return new Response(parsed.error, { status: 400 })
  }
  if (isOrg && !authorityAttested) {
    return new Response(
      'The signatory must confirm they are authorized to bind the organization.',
      {
        status: 400,
      }
    )
  }

  // Writes go through the service role: grant_agreement_private is RLS-locked
  // to it, and grant_agreements writes are locked down by migration
  // 20260725000001 to close the "any authenticated user can overwrite any
  // agreement" hole.
  const supabaseAdmin = createAdminClient()

  // Refuse to overwrite an executed agreement. The UI hides the button once
  // signed, but this endpoint is reachable directly, and the row now carries
  // signature state rather than just a snapshot -- without this, a creator could
  // replace an agreement already signed by an external signatory and
  // countersigned by an admin.
  const { data: existing } = await supabaseAdmin
    .from('grant_agreements')
    .select('signed_at')
    .eq('project_id', projectId)
    .maybeSingle()
    .throwOnError()
  if (existing?.signed_at) {
    return new Response('This agreement has already been signed.', { status: 409 })
  }

  const signedAt = new Date().toISOString()

  // Rendered before the write, from the values about to be written, so the
  // stored artifact and the row are produced in one round trip.
  const documentHtml = parsed
    ? renderOrgAgreementHtml({
        project,
        values: parsed,
        excludeLobbyingClause: project.lobbying,
      })
    : renderIndividualAgreementHtml({
        project,
        agreement: {
          signed_at: signedAt,
          lobbying_clause_excluded: project.lobbying,
          version: CURRENT_AGREEMENT_VERSION,
          recipient_name: project.profiles.full_name,
          project_title: project.title,
        } as GrantAgreement,
      })

  await commitSignature({
    supabaseAdmin,
    activationClient: supabase,
    project,
    signedAt,
    documentHtml,
    agreementColumns: parsed
      ? {
          recipient_type: 'organization',
          ...parsed,
          signatory_authority_attested: true,
          org_agreement_version: CURRENT_ORG_AGREEMENT_VERSION,
          version: null,
        }
      : {
          recipient_type: 'individual',
          recipient_name: project.profiles.full_name,
          signatory_name: project.profiles.full_name,
          version: CURRENT_AGREEMENT_VERSION,
          // Clear any org draft the creator started and then abandoned:
          // upsert only writes the columns given, so leaving these out
          // would sign an individual agreement onto a row still asserting
          // an entity class, an EIN and an attested org signatory.
          recipient_address: null,
          recipient_country: null,
          recipient_entity_class: null,
          recipient_tax_id: null,
          foreign_no_tin: false,
          signatory_authority_attested: false,
          org_agreement_version: null,
        },
    privatePatch: {
      signatory_email: user.email ?? null,
      signed_ip: clientIp(req),
      signed_user_agent: req.headers.get('user-agent'),
      // A self-signed agreement has no outstanding link; clear any earlier one
      // so a previously emailed token can't still be used.
      signing_token_hash: null,
      token_sent_to: null,
      token_sent_at: null,
      token_expires_at: null,
    },
  })

  const attestation = parsed
    ? `I, ${parsed.signatory_name}, am authorized to enter into this agreement on behalf of ${parsed.recipient_name}, and agree to the terms of this grant as laid out in the above document.`
    : `I, ${project.profiles.full_name}, agree to the terms of this grant as laid out in the above document.`

  // The signature is committed; a failed records-copy email must not surface as
  // a signing failure (a retry would just hit the already-signed 409).
  try {
    await notify({
      to: user.id,
      reason: 'agreement_record',
      projectId: project.id,
      email: templateEmail(
        TEMPLATE_IDS.GENERIC_NOTIF_HTML,
        {
          subject: 'Your Manifund grant agreement',
          htmlContent: agreementEmailHtml({
            greetingName: parsed ? parsed.signatory_name : project.profiles.full_name,
            documentHtml,
            attestation,
          }),
          buttonUrl: `manifund.org/projects/${project.slug}`,
          buttonText: 'View your project',
        },
        user.id
      ),
    })
  } catch (e) {
    console.error('Failed to email signed agreement copy:', e)
  }
  return NextResponse.json({ success: true })
}
