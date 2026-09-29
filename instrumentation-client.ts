import posthog from 'posthog-js'
// Bundle the replay recorder: fetching it at runtime gets adblocked by filename
import 'posthog-js/dist/posthog-recorder'
import { NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_POSTHOG_KEY } from './db/env'

const missingPostHogVariable = !NEXT_PUBLIC_POSTHOG_KEY
  ? 'NEXT_PUBLIC_POSTHOG_KEY'
  : !NEXT_PUBLIC_POSTHOG_HOST
    ? 'NEXT_PUBLIC_POSTHOG_HOST'
    : undefined

if (missingPostHogVariable && process.env.NODE_ENV === 'development') {
  throw new Error(
    `${missingPostHogVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingPostHogVariable} is configured`,
  )
}

// NODE_ENV gate rather than isProd(): `bun run dev` uses prod Supabase but must not send analytics
if (
  process.env.NODE_ENV === 'production' &&
  !missingPostHogVariable &&
  NEXT_PUBLIC_POSTHOG_KEY &&
  NEXT_PUBLIC_POSTHOG_HOST
) {
  posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/flux', // reverse-proxied to PostHog via rewrites in next.config.js
    defaults: '2026-08-29',
    persistence: 'memory', // nothing stored on device, so no cookie banner needed
    capture_pageleave: true,
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true },
    },
  })
}
