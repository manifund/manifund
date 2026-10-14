import { readStopToken } from '@/lib/notifications/settings'
import { StopConfirm } from './stop-confirm'

// Where an optional email's "Unsubscribe" lands (N6). Opening it changes nothing (mail scanners open every link);
// the button does, and Undo puts it back. No sign-in needed.
export default async function StopPage(props: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await props.searchParams
  const valid = !!(await readStopToken(t))
  return (
    <div className="mx-auto max-w-md p-6">
      {valid ? (
        <StopConfirm token={t} />
      ) : (
        <p className="text-sm text-gray-700">
          This link isn't valid. You can choose how often you get emails on your notifications page.
        </p>
      )}
    </div>
  )
}
