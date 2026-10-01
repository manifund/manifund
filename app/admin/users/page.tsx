import { createAdminClient } from '@/db/edge'
import { DownloadTextButton } from '../download-text-button'
import { userBalances } from '../utils'
import { UserTable } from './user-table'
import { requireAdmin } from '@/lib/require-admin'

export default async function UsersPage() {
  await requireAdmin() // before any admin-client read: the layout's check alone doesn't stop the page
  const supabaseAdmin = createAdminClient()
  const [{ data: users }, { data: profiles }, { data: txns }] = await Promise.all([
    supabaseAdmin.from('users').select('*'),
    supabaseAdmin.from('profiles').select('*'),
    supabaseAdmin.from('txns').select('*').eq('token', 'USD').order('created_at'),
  ])

  const userAndProfiles =
    users?.map((user) => {
      const profile = profiles?.find((p) => p.id === user.id)
      return { ...user, profile }
    }) ?? []

  const balances = userBalances(txns ?? [])

  const usersCSV =
    'email,name,username,id,balance\n' +
    userAndProfiles
      .map((user) => {
        return [
          user.email,
          user.profile?.full_name,
          user.profile?.username,
          user.id,
          balances.get(user.id ?? '') ?? 0,
        ].join(',')
      })
      .join('\n')

  const rows = userAndProfiles.map((user) => ({
    id: user.id ?? '',
    email: user.email ?? '',
    username: user.profile?.username ?? null,
    accredited: (user.profile?.accreditation_status as boolean) ?? false,
    balance: balances.get(user.id ?? '') ?? 0,
  }))

  return (
    <>
      <DownloadTextButton
        buttonText="Export users.csv"
        toDownload={usersCSV}
        filename="users.csv"
      />
      <UserTable users={rows} />
    </>
  )
}
