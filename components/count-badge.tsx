import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// The unread count on an icon (N10), like LinkedIn or GitHub: a small dot with the number,
// "9+" above nine, nothing at zero.
export function CountBadge(props: { count?: number | null }) {
  const { count } = props
  if (!count) return null
  return (
    <span
      aria-label={`${count} unread`}
      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

// The unread count to show in the nav (C25). The sidebar and the bottom bar sit in the root layout, which Next
// keeps across client-side navigation, so the server's count would stay stale after the visit to /notifications
// that marks everything read. Once you've been on that page, the count hides until the server sends a new one
// (callers put the count in `key`, so a later notification remounts the item and shows again).
export function useUnreadAfterVisit(unread: number) {
  const onPage = usePathname() === '/notifications'
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (onPage) setSeen(true)
  }, [onPage])
  return seen || onPage ? 0 : unread
}
