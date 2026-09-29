export const SUPABASE_ENV = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? 'PROD'

export const SUPABASE_URL =
  SUPABASE_ENV === 'PROD'
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL_DEV
export const SUPABASE_ANON_KEY =
  SUPABASE_ENV === 'PROD'
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV
export const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_ENV === 'PROD'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV

export const SUPABASE_BUCKET_URL =
  process.env.SUPABASE_BUCKET_URL ?? 'https://fkousziwzbnkdkldjper.supabase.co'

export const NEXT_PUBLIC_STRIPE_KEY =
  SUPABASE_ENV === 'PROD'
    ? process.env.NEXT_PUBLIC_STRIPE_LIVE_KEY
    : process.env.NEXT_PUBLIC_STRIPE_TEST_KEY

export const STRIPE_SECRET_KEY =
  SUPABASE_ENV === 'PROD' ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_TEST_SECRET_KEY

export const NEXT_PUBLIC_POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
export const NEXT_PUBLIC_POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

export function isProd() {
  return SUPABASE_ENV === 'PROD'
}
