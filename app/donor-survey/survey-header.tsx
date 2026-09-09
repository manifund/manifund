import Image from 'next/image'
import Link from 'next/link'

// Small brand header for the standalone survey pages.
export function SurveyHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2.5 text-gray-900 hover:no-underline">
        <Image
          src="/Manifox.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
        <span className="text-[17px] font-semibold tracking-[-0.01em]">Manifund</span>
      </Link>
    </header>
  )
}

export function SurveyShell(props: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-14 px-6 pb-24 pt-12 text-gray-900">
      <SurveyHeader />
      {props.children}
    </div>
  )
}
