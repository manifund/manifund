import { redirect } from 'next/navigation'

// The email choice moved to /notifications (Vals, 2026-10-14). Kept as a redirect until every link points there.
export default function NotificationSettingsMoved() {
  redirect('/notifications')
}
