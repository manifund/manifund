// The sign-in form and its server actions (docs/ai-reference/accounts/README.md), rendered to HTML or called with a
// stand-in Supabase client: nothing reaches Supabase, Google or an inbox. Here rather than tests/unit because the
// actions import next/navigation, which won't load under `--conditions react-server`.
//
// `@/db/supabase-server` is replaced for this whole test process (Bun keeps module mocks across files): the stand-in
// throws unless a test set one, as the real one would outside a request.
import { describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as constants from '@/utils/constants'
import { getURL, SIGNUP_DISABLED_MESSAGE } from '@/utils/constants'

let supabase: any
mock.module('@/db/supabase-server', () => ({
  createServerSupabaseClient: async () => {
    if (!supabase)
      throw new Error('no Supabase client outside a request (tests/components/accounts.test.tsx)')
    return supabase
  },
}))
const { default: AuthModal } = await import('@/components/auth/AuthModal')
const { PasswordInput } = await import('@/components/password-input')
const actions = await import('@/lib/auth-actions')

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}
// Calls fn with a stand-in client whose auth methods record their arguments.
async function withAuth<T>(auth: Record<string, (...a: any[]) => any>, fn: () => Promise<T>) {
  supabase = { auth }
  try {
    return await fn()
  } finally {
    supabase = undefined
  }
}

describe('S1 one form: email and password, or Google', () => {
  test('signing in, with links to create an account or reset the password', () => {
    const html = renderToStaticMarkup(<AuthModal isOpen />)
    for (const text of [
      'Continue with Google',
      'type="email"',
      'name="password"',
      'Sign in',
      'Sign up',
      'Forgot your password?',
    ]) {
      expect(html).toContain(text)
    }
  })
})

describe('S2 password fields have a show/hide button', () => {
  test('the field starts hidden, with a button to show it', () => {
    const html = renderToStaticMarkup(<PasswordInput id="pw" name="pw" />)
    expect(html).toContain('type="password"')
    expect(html).toContain('aria-label="Show password"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-controls="pw"')
  })
  test('the sign-in form uses it', () => {
    expect(renderToStaticMarkup(<AuthModal isOpen />)).toContain('aria-label="Show password"')
  })
})

describe('S4 a failed link shows why, on the sign-in form', () => {
  test('the reason from the link', () => {
    const html = renderToStaticMarkup(
      <AuthModal
        isOpen
        authError={{ error: 'invalid_request', errorDescription: 'This link is malformed.' }}
      />
    )
    expect(html).toContain('Authentication Error')
    expect(html).toContain('This link is malformed.')
  })
  test('an expired link says so', () => {
    const html = renderToStaticMarkup(
      <AuthModal isOpen authError={{ error: 'access_denied', errorCode: 'otp_expired' }} />
    )
    expect(html).toContain('Email Link Expired')
    expect(html).toContain('The email link you clicked has expired')
  })
  test("a refused sign-in returns Supabase's reason to the form", async () => {
    const result = await withAuth(
      { signInWithPassword: async () => ({ error: { message: 'Invalid login credentials' } }) },
      () => actions.signIn(form({ email: 'nobody@local.test', password: 'wrong' }))
    )
    expect(result).toEqual({ type: 'error', text: 'Invalid login credentials' })
  })
})

describe('S10 a grant recipient is asked to use the address the grant was sent to', () => {
  test('the address from /login?email= is shown', () => {
    const html = renderToStaticMarkup(<AuthModal isOpen recommendedEmail="ada@local.test" />)
    expect(html).toContain('same email that your grant notification was sent to')
    expect(html).toContain('ada@local.test')
  })
})

describe('S5 creating an account by email: confirm, then fill in the profile', () => {
  test('the confirmation link goes through /auth/callback to /edit-profile', async () => {
    let asked: any
    const result = await withAuth(
      { signUp: async (a: any) => ((asked = a), { error: null }) },
      () => actions.signUp(form({ email: 'new@local.test', password: 'localpass123' }))
    )
    expect(asked).toEqual({
      email: 'new@local.test',
      password: 'localpass123',
      options: { emailRedirectTo: `${getURL()}auth/callback?next=/edit-profile` },
    })
    expect(result).toEqual({
      type: 'success',
      text: 'Account created! Check your email to continue signing up',
    })
  })
  test("Supabase's refusal is shown as is", async () => {
    const result = await withAuth(
      { signUp: async () => ({ error: { message: 'Password should be at least 6 characters.' } }) },
      () => actions.signUp(form({ email: 'new@local.test', password: '123' }))
    )
    expect(result).toEqual({ type: 'error', text: 'Password should be at least 6 characters.' })
  })
})

describe('S11 new accounts can be switched off in code', () => {
  test('today they are on', () => {
    expect(constants.DISABLE_NEW_SIGNUPS_AND_PROJECTS).toBe(false)
  })
  test('switched off, creating an account is refused before reaching Supabase', async () => {
    const real = { ...constants }
    mock.module('@/utils/constants', () => ({ ...real, DISABLE_NEW_SIGNUPS_AND_PROJECTS: true }))
    let reached = false
    try {
      const result = await withAuth(
        { signUp: async () => ((reached = true), { error: null }) },
        () => actions.signUp(form({ email: 'new@local.test', password: 'localpass123' }))
      )
      expect(result).toEqual({ type: 'error', text: SIGNUP_DISABLED_MESSAGE })
      expect(SIGNUP_DISABLED_MESSAGE).toContain('hi@manifund.org')
      expect(reached).toBe(false)
    } finally {
      mock.module('@/utils/constants', () => real)
    }
  })
})

describe('S12 a reset link goes through /auth/callback to the new-password page', () => {
  test('the redirect asked of Supabase', async () => {
    let asked: any[] = []
    const result = await withAuth(
      { resetPasswordForEmail: async (...a: any[]) => ((asked = a), { error: null }) },
      () => actions.resetPassword(form({ email: 'ada@local.test' }))
    )
    expect(asked).toEqual([
      'ada@local.test',
      { redirectTo: `${getURL()}auth/callback?next=%2Fedit-profile%2Freset-password` },
    ])
    expect(result.type).toBe('success')
  })
  test.todo('S12 the new password is typed twice, matching, at least 6 characters (needs a browser)', () => {})
})

describe('S3 Google brings people back to where they were going', () => {
  const google = async (next?: string) => {
    let asked: any
    const result = await withAuth(
      {
        signInWithOAuth: async (a: any) => (
          (asked = a), { data: { url: 'https://accounts.example/o' }, error: null }
        ),
      },
      () => actions.signInWithGoogle(next)
    )
    return { asked, result }
  }
  test('the path travels through /auth/callback', async () => {
    const { asked, result } = await google('/sso?next=https://trace.manifund.org&then=/x')
    expect(asked.provider).toBe('google')
    expect(asked.options.redirectTo).toBe(
      `${getURL()}auth/callback?next=${encodeURIComponent('/sso?next=https://trace.manifund.org&then=/x')}`
    )
    expect(result).toEqual({ type: 'success', text: 'https://accounts.example/o' })
  })
  test('another site, or nothing, becomes the home page', async () => {
    for (const next of ['https://evil.example', '//evil.example', undefined]) {
      expect((await google(next)).asked.options.redirectTo).toBe(
        `${getURL()}auth/callback?next=%2F`
      )
    }
  })
})

describe('Not testable without Google or a browser', () => {
  test.todo('S6 Continue with Google creates the account on first use (needs Google)', () => {})
  test.todo('S14 email accounts change their password on /edit-profile; Google accounts see no form (needs a browser)', () => {})
  test.todo('S15 signing out lands on the home page, signed out (needs a browser)', () => {})
})
