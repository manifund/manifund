import { formatDistanceToNow } from 'date-fns'

// Relative timestamps drift between server render and client hydration
// ("3 minutes ago" vs "4 minutes ago"), which fails hydration (React #418)
// and forces a full client re-render. suppressHydrationWarning keeps the
// server text instead.
export function RelativeTime(props: { date: string | Date; className?: string }) {
  const { date, className } = props
  return (
    <span
      suppressHydrationWarning
      className={className}
      title={new Date(date).toLocaleString()}
    >
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </span>
  )
}
