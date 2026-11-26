import clsx from 'clsx'
import { HEADING_CLASS, SECTION_CLASS } from './styles'

// Placeholders while a profile's parts stream in: the same shapes, in grey.

const bar = 'animate-pulse rounded bg-gray-200/70 motion-reduce:animate-none'

export function SectionSkeleton(props: {
  id: string
  title?: string
  shape: 'cards' | 'rows' | 'text'
}) {
  const { id, title, shape } = props
  return (
    <section id={id} className={SECTION_CLASS} aria-busy="true">
      {title && <h2 className={HEADING_CLASS}>{title}</h2>}
      {shape === 'cards' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={clsx(bar, 'h-56 rounded-lg')} />
          ))}
        </div>
      )}
      {shape === 'rows' && (
        <div className="flex flex-col divide-y divide-gray-100 rounded-lg bg-white shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className={clsx(bar, 'h-4 flex-1')} />
              <div className={clsx(bar, 'h-4 w-16')} />
            </div>
          ))}
        </div>
      )}
      {shape === 'text' && (
        <div className="flex flex-col gap-2.5">
          <div className={clsx(bar, 'h-4 w-full')} />
          <div className={clsx(bar, 'h-4 w-11/12')} />
          <div className={clsx(bar, 'h-4 w-2/3')} />
        </div>
      )}
    </section>
  )
}

export function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-start gap-6" aria-busy="true">
      <div className={clsx(bar, 'h-[88px] w-[88px] rounded-full')} />
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 pt-1">
        <div className={clsx(bar, 'h-9 w-64')} />
        <div className={clsx(bar, 'h-4 w-40')} />
        <div className={clsx(bar, 'mt-2 h-5 w-full max-w-[560px]')} />
      </div>
    </div>
  )
}
