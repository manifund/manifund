import { readStopToken } from '@/lib/notifications/settings'
import { groupByKey, type NotificationGroup } from '@/lib/notifications/groups'
import { StopConfirm } from './stop-confirm'

// Where an email's "Unsubscribe from these emails" button lands (N7). Opening it changes nothing (mail
// scanners open every link); the button does, and Undo puts it back. No sign-in needed.
export default async function StopPage(props: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await props.searchParams
  const parsed = await readStopToken(t)
  const groups = parsed?.groupKeys.map(groupByKey) ?? []
  const valid = groups.every(Boolean) ? (groups as NotificationGroup[]) : []
  return (
    <div className="mx-auto max-w-md p-6">
      {!valid.length ? (
        <p className="text-sm text-gray-700">
          This link isn't valid. You can change your emails in your notification settings.
        </p>
      ) : valid.some((g) => g.always) ? (
        <p className="text-sm text-gray-700">Manifund always sends these emails.</p>
      ) : (
        <StopConfirm token={t} labels={valid.map((g) => g.label)} />
      )}
    </div>
  )
}
