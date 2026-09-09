// Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron invocations when
// the CRON_SECRET env var is set. Fails closed if it isn't.
export function isAuthorizedCron(req: { headers: { get(name: string): string | null } }) {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}
