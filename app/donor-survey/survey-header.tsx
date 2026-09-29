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

export function SurveyShell(props: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-20 px-6 pb-24 pt-12 text-gray-900">
      <SurveyHeader />
      {props.children}
    </div>
  )
}
