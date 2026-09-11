'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSupabase } from '@/db/supabase-provider'
import { revalidateAfterAuth } from '@/lib/auth-actions'
import { safeNext } from '@/utils/safe-next'

// Used to clean up the URL after the OAuth callback is complete.
export function OAuthCodeHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase } = useSupabase()

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const code = searchParams?.get('code')

      if (code) {
        try {
          // The Supabase client automatically handles the code exchange
          // We just need to check if the user is authenticated
          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (session) {
            // User is authenticated, clean up the URL
            const currentUrl = new URL(window.location.href)

            // Remove OAuth-related parameters
            currentUrl.searchParams.delete('code')
            currentUrl.searchParams.delete('error')
            currentUrl.searchParams.delete('error_description')

            // Check if there's a 'next' parameter for redirect
            const next = safeNext(searchParams?.get('next')) || '/'

            // Use replaceState to update URL without navigation
            window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search)

            // Revalidate the path to update server components
            await revalidateAfterAuth()

            // If we have a different destination, navigate there
            if (next !== currentUrl.pathname) {
              router.push(next)
            } else {
              // Force a refresh to show updated UI
              router.refresh()
            }
          }
        } catch (error) {
          console.error('OAuth callback error:', error)
          // Clean up URL even on error
          const currentUrl = new URL(window.location.href)
          currentUrl.searchParams.delete('code')
          window.history.replaceState({}, '', currentUrl.pathname)
        }
      }
    }

    void handleOAuthCallback()
  }, [searchParams, supabase, router])

  // This component doesn't render anything
  return null
}
