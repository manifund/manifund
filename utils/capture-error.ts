import posthog from 'posthog-js'

// Reports an error we caught and showed to the user (modal/toast) to PostHog
// error tracking. Caught errors never hit error boundaries or window.onerror,
// so without this they are invisible — e.g. the Falcon Fund create-project
// failures of Sep 2026. No-op when PostHog isn't initialized (dev, previews).
export function captureHandledError(error: unknown, context: Record<string, unknown> = {}) {
  try {
    posthog.captureException(error instanceof Error ? error : new Error(String(error)), {
      handled: true,
      ...context,
    })
  } catch {
    // Never let error reporting break the UI
  }
}
