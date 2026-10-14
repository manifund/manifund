import { createServerSupabaseClient } from '@/db/supabase-server'
import { createAdminClient } from '@/db/edge'
import { getUser, isAdmin } from '@/db/profile'
import { getProjectAndProfileBySlug } from '@/db/project'
import React from 'react'
import { AgreementFlow } from './agreement-flow'
import { AdminTaxPanel } from './admin-tax-panel'
import { getGrantAgreement, getGrantAgreementPrivate } from '@/db/grant_agreement'
import { Row } from '@/components/layout/row'
import { Tag } from '@/components/tags'

export default async function GrantAgreementPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createServerSupabaseClient()
  const project = await getProjectAndProfileBySlug(supabase, slug)
  if (!project || project.approved === false) {
    return <div>404</div>
  }
  const user = await getUser(supabase)
  const userIsOwner = user?.id === project.creator
  const userIsAdmin = isAdmin(user)
  const canSeePrivate = userIsOwner || userIsAdmin
  if ((project.stage === 'hidden' || project.stage === 'draft') && !canSeePrivate) {
    return <div>404</div>
  }
  const agreement = (await getGrantAgreement(supabase, project.id)) ?? undefined

  // Read with the admin client because grant_agreement_private is RLS-locked to
  // the service role. Only the EIN-exists flag crosses to the client for
  // everyone; the EIN itself and the signatory's email go no further than the
  // creator and admins.
  const priv = agreement ? await getGrantAgreementPrivate(createAdminClient(), project.id) : null
  const awaitingExternalSignature = !!priv?.token_sent_to && !agreement?.signed_at

  return (
    <div className="p-5">
      <Row className="gap-3">
        <h1 className="text-xl font-semibold">Grant Agreement</h1>
        <Tag
          text={
            project.signed_agreement
              ? project.approved
                ? 'COMPLETE'
                : 'AWAITING COUNTER SIGNATURE'
              : awaitingExternalSignature
                ? 'AWAITING SIGNATORY'
                : 'AWAITING SIGNATURE'
          }
          color={project.signed_agreement && project.approved ? 'orange' : 'rose'}
        />
      </Row>
      <p className="mb-5 text-sm text-gray-500">
        All grant recipients are required to agree to the terms and conditions outlined here before
        receiving funds.
      </p>
      {agreement?.signed_off_site ? (
        <div className="rounded-md bg-gray-200 p-4 text-gray-600">
          This grant agreement was signed off-site. We have grantees sign agreements elsewhere in
          cases where they need a modified version of the agreement, or where they want to preserve
          their anonymity on Manifund.
        </div>
      ) : (
        <AgreementFlow
          project={project}
          agreement={agreement}
          userIsOwner={userIsOwner}
          signatoryEmail={canSeePrivate ? (priv?.signatory_email ?? null) : null}
          tokenSentTo={canSeePrivate ? (priv?.token_sent_to ?? null) : null}
          tokenSentAt={canSeePrivate ? (priv?.token_sent_at ?? null) : null}
        />
      )}
      {userIsAdmin && agreement?.recipient_type === 'organization' && (
        <div className="mt-10">
          <AdminTaxPanel
            projectId={project.id}
            signatoryEmail={priv?.signatory_email ?? null}
            initial={{
              w9Received: !!priv?.w9_received_at,
              w8Received: !!priv?.w8_received_at,
              determinationLetterOnFile: !!priv?.determination_letter_on_file,
              foreignWithholding: !!priv?.foreign_withholding_flag,
            }}
          />
        </div>
      )}
    </div>
  )
}
