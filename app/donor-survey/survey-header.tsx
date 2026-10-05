import Image from 'next/image'
import Link from 'next/link'

// Brand header for the standalone survey pages: the same fox and gradient
// Josefin wordmark as the site sidebar, a size down.
export function SurveyHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/" className="group flex items-center gap-1 hover:no-underline">
        <Image
          src="/Manifox.png"
          alt="Manifund fox"
          width={100}
          height={100}
          className="h-auto w-10 -translate-y-1 transition-all group-hover:-translate-y-1.5"
        />
        <span className="bg-gradient-to-r from-orange-500 to-rose-400 bg-clip-text font-josefin text-2xl font-[650] text-transparent">
          Manifund
        </span>
      </Link>
    </header>
  )
}

// The orange section heading shared by the survey, its results and donor pages.
export function SectionHeading(props: { title: string; badge?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-3">
      <h2 className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text font-josefin text-[30px] font-[650] leading-none text-transparent">
        {props.title}
      </h2>
      {props.badge && (
        <span className="rounded-full bg-gray-100 px-2 py-[3px] text-xs text-gray-500">
          {props.badge}
        </span>
      )}
    </div>
  )
}

// The column's side padding matches the rest of the site on phones (12px).
export function SurveyShell(props: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-14 px-3 pb-24 pt-14 text-gray-900 sm:px-6">
      <SurveyHeader />
      {props.children}
    </div>
  )
}
