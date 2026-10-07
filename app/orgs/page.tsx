import { createServerSupabaseClient } from '@/db/supabase-server'
import { listDirectoryOrgs } from '@/db/org'
import { OrgsDirectory } from './orgs-directory'

export const revalidate = 60
export const metadata = { title: 'Orgs' }

export default async function OrgsPage() {
  const supabase = await createServerSupabaseClient()
  const thisYear = new Date().getUTCFullYear()
  const orgs = await listDirectoryOrgs(supabase, thisYear)
  return <OrgsDirectory orgs={orgs} />
}
