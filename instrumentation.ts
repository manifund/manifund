import type { Instrumentation } from 'next'
import { waitUntil } from '@vercel/functions'

export function register() {}

// Reports every unhandled server-side error (API routes, server components,
// server actions) to PostHog error tracking. The key is only set in the Vercel
// Production env, so previews and local dev are no-ops.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return
  const report = (async () => {
    try {
      const { PostHog } = await import('posthog-node')
      const posthog = new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
      await posthog.captureException(error, undefined, {
        path: request.path,
        method: request.method,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        runtime: process.env.NEXT_RUNTIME,
      })
      await posthog.shutdown()
    } catch (e) {
      console.error('Failed to report error to PostHog:', e)
    }
  })()
  try {
    // Edge isolates freeze once the 500 goes out and Next doesn't await this
    // hook there, killing the in-flight send — ask Vercel to keep us alive
    waitUntil(report)
  } catch {
    // Not running on Vercel
  }
  await report
}
