'use client'
import { TrophyIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Link from 'next/link'
import { Tooltip } from './tooltip'

// Shown on projects whose latest AI evaluation is 4 or 5 (P11)
export function AiTrophy(props: { href?: string; className?: string }) {
  const { href, className } = props
  const icon = <TrophyIcon className="h-5 w-5 text-orange-500" />
  return (
    <Tooltip
      text="This was highly rated by our experimental AI rating system"
      className={clsx('font-normal', className)}
    >
      {href ? (
        <Link
          href={href}
          scroll={false}
          aria-label="AI review"
          onClick={() =>
            document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          {icon}
        </Link>
      ) : (
        icon
      )}
    </Tooltip>
  )
}
