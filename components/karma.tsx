'use client'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  Placement,
  safePolygon,
  shift,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import Link from 'next/link'
import clsx from 'clsx'
import { ReactNode, useState } from 'react'
import { KARMA_CONFIG, ProfileKarmaBreakdown, ProjectKarmaBreakdown } from '@/utils/karma'
import { formatMoney } from '@/utils/formatting'

type Line = { label: string; formula: ReactNode; value: number }

const c = KARMA_CONFIG
// `|| 0` turns -0 into 0
const fmt = (n: number) => (Math.round(n) || 0).toLocaleString()
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const dollarFormula = (
  <>
    {c.donationScale} × $<sup>{c.donationExponent}</sup>
  </>
)
const weightFormula = (who: string) => (
  <>
    log<sub>{c.weightLogBase}</sub>({who} karma) each
  </>
)

// Votes nudge the stored total between recomputes without touching the breakdown,
// so the votes line takes whatever the other lines don't explain.
function projectLines(b: ProjectKarmaBreakdown, total: number): Line[] {
  return [
    {
      label: 'Donations',
      formula: (
        <>
          {dollarFormula} per donor · {plural(b.donorCount, 'donor')}
        </>
      ),
      value: b.donations,
    },
    {
      label: 'Creator bonus',
      formula: (
        <>
          {c.creatorKarmaCoefficient} × log<sub>10</sub>(1 + creator karma)
        </>
      ),
      value: b.creator,
    },
    {
      label: 'Votes',
      formula: <>± {weightFormula('voter')}</>,
      value: total - b.donations - b.creator - b.comments - b.base,
    },
    {
      label: 'Comments',
      formula: weightFormula('commenter'),
      value: b.comments,
    },
    { label: 'Base', formula: 'every project', value: b.base },
  ]
}

function profileLines(b: ProfileKarmaBreakdown, total: number): Line[] {
  const lines: Line[] = [
    {
      label: 'Received',
      formula: (
        <>
          {dollarFormula} per donor
          {b.dollarsReceived != null && ` · ${formatMoney(b.dollarsReceived)}`}
        </>
      ),
      value: b.donationsReceived,
    },
    {
      label: 'Votes',
      formula: <>± {weightFormula('voter')}</>,
      value: total - b.donationsReceived - b.donationsGiven - b.reacts - b.starting,
    },
    {
      label: 'Given',
      formula: (
        <>
          {dollarFormula} per project · {plural(b.projectsDonatedTo, 'project')}
          {b.dollarsGiven != null && `, ${formatMoney(b.dollarsGiven)}`}
        </>
      ),
      value: b.donationsGiven,
    },
    {
      label: 'Reactions',
      formula: (
        <>
          {c.reactMultiplier} × {weightFormula('reactor')}
        </>
      ),
      value: b.reacts,
    },
  ]
  if (b.starting > 0) {
    lines.push({ label: 'Starting', formula: 'has deposited money', value: b.starting })
  }
  return lines
}

function Star(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  )
}

// Karma number with a hover card that shows the math behind it.
export function Karma(props: {
  value: number | null | undefined
  breakdown: unknown
  kind: 'project' | 'profile'
  size?: 'sm' | 'md'
  noStar?: boolean
  placement?: Placement
  className?: string
}) {
  const { kind, size = 'sm', noStar, className } = props
  const value = props.value ?? 0
  const [open, setOpen] = useState(false)
  const { x, y, strategy, reference, floating, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: props.placement ?? 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: 100 }, handleClose: safePolygon() }),
    useRole(context, { role: 'tooltip' }),
  ])
  const lines = !props.breakdown
    ? null
    : kind === 'project'
      ? projectLines(props.breakdown as ProjectKarmaBreakdown, value)
      : profileLines(props.breakdown as ProfileKarmaBreakdown, value)
  return (
    <>
      <span
        ref={reference}
        {...getReferenceProps()}
        className={clsx(
          'inline-flex cursor-help items-center gap-1 font-semibold text-orange-700',
          size === 'md' ? 'text-base' : 'text-sm',
          className
        )}
      >
        {!noStar && <Star className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
        {fmt(value)}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={floating}
            {...getFloatingProps()}
            style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
            className="z-30 w-[22rem] max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-left text-sm font-normal text-gray-900 shadow-lg"
          >
            {lines ? (
              <div className="flex flex-col gap-1.5">
                {lines.map((line) => (
                  <div key={line.label} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{line.label}</span>{' '}
                      <span className="text-gray-500">{line.formula}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{fmt(line.value)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 font-semibold text-orange-700">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(value)}</span>
                </div>
              </div>
            ) : (
              <span className="text-gray-500">Karma hasn&apos;t been computed yet.</span>
            )}
            <Link
              href="/about/karma"
              className="mt-2 block text-xs text-orange-600 hover:underline"
            >
              How karma is calculated →
            </Link>
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
