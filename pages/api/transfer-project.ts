// Called by Supabase webhook trigger on projects table UPDATE.
// If Vercel Attack Challenge Mode is on, this endpoint must be bypassed in Vercel Firewall rules,
// otherwise the webhook will be blocked by the security checkpoint.
import { createAdminClient } from '@/db/edge'
import { NextApiRequest, NextApiResponse } from 'next'
import { User } from '@supabase/supabase-js'
import { getTransfersByEmail } from '@/db/project-transfer'
import { isAuthorizedWebhook } from '@/utils/webhook-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const user = req.body.record as User
  const supabaseAdmin = createAdminClient()
  const projectTransfers = await getTransfersByEmail(supabaseAdmin, user.email ?? '')
  for (const transfer of projectTransfers) {
    if (!transfer.transferred) {
      let args = {
        project_id: transfer.projects.id,
        to_id: user.id,
        transfer_id: transfer.id,
      }
      await supabaseAdmin.rpc('_transfer_project', args).throwOnError()
    }
  }
  return res.status(200).json({ transferred: projectTransfers.length })
}
