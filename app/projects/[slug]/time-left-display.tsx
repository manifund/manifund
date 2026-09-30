import { Row } from '@/components/layout/row'
import { differenceInDays, differenceInHours } from 'date-fns'

export function TimeLeftDisplay(props: { closeDate: string }) {
  // Close it at midnight PST
  const closeDate = new Date(`${props.closeDate}T23:59:59-07:00`)
  const now = new Date()
  const daysLeft = differenceInDays(closeDate, now)
  const hoursLeft = daysLeft < 1 ? differenceInHours(closeDate, now) : 0
  return (
    <Row className="items-center gap-1 text-sm text-gray-900">
      <span suppressHydrationWarning className="font-semibold">{`${Math.max(
        hoursLeft ? hoursLeft : daysLeft,
        0
      )} ${hoursLeft ? 'hours' : 'days'}`}</span>
      <span>left to contribute</span>
    </Row>
  )
}
