'use client'

import { useSupabase } from '@/db/supabase-provider'
import { useRouter } from 'next/navigation'
import { buttonClass } from '@/components/button'

export function SignOutButton() {
  const { supabase } = useSupabase()
  const router = useRouter()
  return (
    <button
      className={buttonClass('xs', 'gray')}
      onClick={async () => {
        await supabase.auth.signOut()
        router.push('/')
        // Re-render server components so cached signed-in UI is dropped
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
