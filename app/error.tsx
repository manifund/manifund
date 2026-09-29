'use client'

import { SiteLink } from '@/components/site-link'
import posthog from 'posthog-js'
import { useEffect } from 'react'

export default function Error(props: { error: Error; reset: () => void }) {
  useEffect(() => {
    posthog.captureException(props.error)
  }, [props.error])

  return (
    <div>
      <p>Error thrown:</p>
      <div className="rounded-md bg-red-100 p-4">{props.error.message}</div>
      <p>Check console logs for more info.</p>
      <div className="mt-10">
        <h3 className="mb-2 text-xl">Common errors</h3>
        <code className="font-bold">JWSError JWSInvalidSignature</code>
        <p>
          This might be due to an auth mismatch between dev and prod Supabase; try{' '}
          <SiteLink followsLinkClass href="/login" className="text-orange-500">
            signing out.
          </SiteLink>
        </p>
        <code className="font-bold">permission denied for schema public</code>
        <p>Run the permissions granting SQL snippet on the dev db.</p>
        <code className="font-bold">cache lookup failed for type 38820</code>
        <p>Restart the dev database</p>
      </div>
    </div>
  )
}
