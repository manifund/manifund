'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/db/supabase-server'
import {
  getURL,
  DISABLE_NEW_SIGNUPS_AND_PROJECTS,
  SIGNUP_DISABLED_MESSAGE,
} from '@/utils/constants'
import { safeNext } from '@/utils/safe-next'

export type AuthResult = {
  type: 'error' | 'success'
  text: string
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (!error) {
    revalidatePath('/', 'layout')
    return { type: 'success', text: 'Signed in' }
  }

  // Return the error
  return { type: 'error', text: error.message }
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  if (DISABLE_NEW_SIGNUPS_AND_PROJECTS) {
    return { type: 'error', text: SIGNUP_DISABLED_MESSAGE }
  }

  const supabase = await createServerSupabaseClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo: `${getURL()}auth/callback?next=/edit-profile`,
    },
  })

  if (error) {
    return { type: 'error', text: error.message }
  }

  return {
    type: 'success',
    text: 'Account created! Check your email to continue signing up',
  }
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()

  const email = formData.get('email') as string
  const baseUrl = getURL()
  // Recovery links have to land on /auth/callback like every other email link:
  // that is the only place a token_hash is verified or a code is exchanged, and
  // without it the reset page waits for a session that never arrives.
  const next = encodeURIComponent('/edit-profile/reset-password')
  const redirectTo = `${baseUrl}auth/callback?next=${next}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    return { type: 'error', text: error.message }
  }

  return {
    type: 'success',
    text: 'Check your email for password reset instructions',
  }
}

export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()

  // Google sends the user to /auth/callback, which reads `next` — without it
  // every OAuth sign-in lands on the home page regardless of where it started.
  const destination = safeNext(next)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getURL()}auth/callback?next=${encodeURIComponent(destination)}`,
    },
  })

  if (error) {
    return { type: 'error', text: error.message }
  }
  return { type: 'success', text: data.url }
}

//eslint-disable-next-line
export async function revalidateAfterAuth() {
  revalidatePath('/', 'layout')
}
