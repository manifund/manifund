import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { GROUPS, effectiveMode } from '@/lib/notifications/groups'
import { loadOverrides } from '@/lib/notifications/settings'
import { SettingsForm } from './settings-form'

// Notification settings (N3, N4): every notification shows in the app; this page chooses, per group, whether its
// emails come right away or in the weekly summary (Vals, 2026-10-12: "just right away or weekly"). Always-emailed
// groups get no row, only the line under the title (Vals, 2026-10-07).
export default async function NotificationSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login?next=/settings/notifications')
  const overrides = await loadOverrides(user.id)
  const always = GROUPS.flatMap((g) => (g.always ? [g.always.about] : []))
  const rows = GROUPS.filter((g) => !g.always).map((g) => ({
    key: g.key,
    section: g.section,
    label: g.label,
    mode: effectiveMode(g, overrides[g.key]),
  }))
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium">Notification settings</h1>
      <p className="mb-5 mt-1 text-sm text-gray-700">
        Choose when you get an email for each kind of notification: right away, or in one weekly
        summary.
        {always.length > 0 && (
          <span className="text-gray-500">
            {' '}
            Manifund always sends emails for {always.join(', and ')}.
          </span>
        )}
      </p>
      <SettingsForm rows={rows} />
    </div>
  )
}
