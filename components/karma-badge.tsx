import Link from 'next/link'
import clsx from 'clsx'
import { Tooltip } from './tooltip'

// Plain-text karma, LessWrong style: a muted number, no icon or pill.
// `label` adds the word "karma"; without it the number stands alone (for list rows).
export function KarmaBadge(props: {
  karma: number | null | undefined
  label?: boolean
  className?: string
}) {
  const { karma, label, className } = props
  const value = Math.round(karma ?? 0).toLocaleString()
  return (
    <Tooltip text={label ? 'How karma is calculated' : `${value} karma`}>
      <Link
        href="/about/karma"
        className={clsx('text-gray-500 hover:text-gray-700 hover:underline', className)}
      >
        {value}
        {label && ' karma'}
      </Link>
    </Tooltip>
  )
}
