import Link from 'next/link'
import { SparklesIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { Tooltip } from './tooltip'

export function KarmaBadge(props: {
  karma: number | null | undefined
  kind: 'profile' | 'project'
  className?: string
}) {
  const { karma, kind, className } = props
  const value = Math.round(karma ?? 0)
  const what = kind === 'profile' ? 'Karma: a signal of contributions to Manifund' : 'Project karma'
  return (
    <Tooltip text={`${what}. Click to see how it's calculated.`}>
      <Link
        href="/about/karma"
        className={clsx(
          'flex items-center gap-0.5 hover:underline',
          kind === 'profile'
            ? 'rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-500'
            : 'text-gray-400',
          className
        )}
      >
        <SparklesIcon className="h-4 w-4" />
        <span>{value.toLocaleString()}</span>
      </Link>
    </Tooltip>
  )
}
