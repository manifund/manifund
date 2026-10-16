import { getProjectAndProfileById } from '@/db/project'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/db/edge'
import { escapeHtml, sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import { getURL, CURRENT_ORG_AGREEMENT_VERSION } from '@/utils/constants'
import { clientIp, commitSignature } from '@/utils/grant-agreement-write'
import { agreementEmailHtml, renderOrgAgreementHtml } from '@/utils/render-agreement'
import { getAgreementBySigningTokenHash, parseOrgValues } from '@/db/grant_agreement'
import { hashSigningToken } from '@/utils/signing-token'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

// Signing by a third party (e.g. a fiscal sponsor's director) who has no
// Manifund account. Authentication is the emailed token and nothing else, so
// this route deliberately never calls getUserAndClient: a signed-in visitor has
// no more authority here than an anonymous one.
export default async function handler(req: NextRequest) {
  const { token, values, authorityAttested } = await req.json()
  if (typeof token !== 'string' || !token) {
    return new Response('This signing link is invalid or has expired.', { status: 404 })
  }

  const supabaseAdmin = createAdminClient()
  const priv = await getAgreementBySigningTokenHash(supabaseAdmin, await hashSigningToken(token))
  // Unknown and expired are reported identically, so the response can't be used
  // to probe which tokens ever existed.
  if (!priv) {
    return new Response('This signing link is invalid or has expired.', { status: 404 })
  }

  const parsed = parseOrgValues(values)
  if ('error' in parsed) {
    return new Response(parsed.error, { status: 400 })
  }
  if (!authorityAttested) {
    return new Response(
      'Please confirm you are authorized to sign on behalf of the organization.',
      { status: 400 }
    )
  }

  const project = await getProjectAndProfileById(supabaseAdmin, priv.project_id)
  if (!project) {
    return new Response('This signing link is invalid or has expired.', { status: 404 })
  }
  const { data: existing } = await supabaseAdmin
    .from('grant_agreements')
    .select('signed_at')
    .eq('project_id', priv.project_id)
    .maybeSingle()
    .throwOnError()
  if (existing?.signed_at) {
    return new Response('This agreement has already been signed.', { status: 409 })
  }

  const signedAt = new Date().toISOString()

  const documentHtml = renderOrgAgreementHtml({
    project,
    values: parsed,
    excludeLobbyingClause: project.lobbying,
  })

  await commitSignature({
    supabaseAdmin,
    activationClient: supabaseAdmin,
    project,
    signedAt,
    documentHtml,
    agreementColumns: {
      recipient_type: 'organization',
      ...parsed,
      signatory_authority_attested: true,
      org_agreement_version: CURRENT_ORG_AGREEMENT_VERSION,
      // The individual-agreement version must not survive on an org agreement;
      // the column defaults to 1 when the draft row is first created.
      version: null,
    },
    privatePatch: {
      signed_ip: clientIp(req),
      signed_user_agent: req.headers.get('user-agent'),
      // Burn the token: the link is single-use once it has produced a signature.
      signing_token_hash: null,
      token_expires_at: null,
    },
  })

  const attestation = `I, ${parsed.signatory_name}, am authorized to enter into this agreement on behalf of ${parsed.recipient_name}, and agree to the terms of this grant as laid out in the above document.`
  const emailHtml = agreementEmailHtml({
    greetingName: parsed.signatory_name,
    documentHtml,
    attestation,
  })

  // The signatory gets the records copy; the creator gets told it's done, since
  // their project only moves forward once this signature lands.
  //
  // The signature is committed and the token burned, so a failed email must not
  // surface as a signing failure: the signatory would see an error page for a
  // signature that succeeded, and the link they'd retry with is already dead.
  if (priv.token_sent_to) {
    try {
      await sendTemplateEmail(
        TEMPLATE_IDS.GENERIC_NOTIF_HTML,
        {
          subject: `Your signed Manifund grant agreement for "${project.title}"`,
          htmlContent: emailHtml,
          buttonUrl: `${getURL()}projects/${project.slug}`,
          buttonText: 'View the project',
        },
        undefined,
        priv.token_sent_to
      )
    } catch (e) {
      console.error('Failed to email signed agreement copy to signatory:', e)
    }
  }
  try {
    await notify({
      to: project.creator,
      reason: 'agreement_record',
      projectId: project.id,
      email: templateEmail(
        TEMPLATE_IDS.GENERIC_NOTIF_HTML,
        {
          subject: `Your grant agreement for "${project.title}" has been signed`,
          htmlContent: `<p>Dear ${escapeHtml(project.profiles.full_name)},</p>
        <p><strong>${escapeHtml(parsed.signatory_name)}</strong> has signed the grant agreement for
        &quot;${escapeHtml(project.title)}&quot; on behalf of
        <strong>${escapeHtml(parsed.recipient_name)}</strong>. A copy is below for your records.</p>
        <hr style="border-top: 3px solid #bbb" />
        ${documentHtml}`,
          buttonUrl: `${getURL()}projects/${project.slug}`,
          buttonText: 'View your project',
        },
        project.creator
      ),
    })
  } catch (e) {
    console.error('Failed to email signed-agreement notice to creator:', e)
  }

  return NextResponse.json({ success: true })
}
