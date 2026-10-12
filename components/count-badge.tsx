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
