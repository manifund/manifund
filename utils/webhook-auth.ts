import { NextApiRequest } from 'next'

// Supabase database webhooks must be configured to send
// `Authorization: Bearer ${SUPABASE_WEBHOOK_SECRET}`. Fails closed if unset.
export function isAuthorizedWebhook(req: NextApiRequest) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET
  return !!secret && req.headers.authorization === `Bearer ${secret}`
}
