import { createServerSupabaseClient } from '@/db/supabase-server'
import { FullCause, listFullCauses } from '@/db/cause'
import { Tag } from '@/components/tags'
import Image from 'next/image'
import Link from 'next/link'

export default async function CausesPage() {
  const supabase = await createServerSupabaseClient()
  const causesList = await listFullCauses(supabase)
  const activePrograms = causesList.filter((c) => c.prize && c.open)
  const pastPrizes = causesList.filter((c) => c.prize && !c.open)
  const regularCauses = causesList.filter((c) => !c.prize)
  return (
    <div className="p-5">
      {activePrograms.length > 0 && (
        <>
          <h1 className="text-lg font-bold text-gray-900 sm:text-2xl">Active programs</h1>
          <span className="text-sm text-gray-600">
            Funding programs currently open to proposals.
          </span>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {activePrograms.map((cause) => (
              <CauseCard key={cause.slug} cause={cause} active />
            ))}
          </div>
        </>
      )}
      <h1 className="mt-10 text-lg font-bold text-gray-900 sm:text-2xl">Past prize rounds</h1>
      <span className="text-sm text-gray-600">
        Funding rounds we&apos;ve run through an impact market.
      </span>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {pastPrizes.map((cause) => (
          <CauseCard key={cause.slug} cause={cause} />
        ))}
      </div>
      <h1 className="mt-10 text-lg font-bold text-gray-900 sm:text-2xl">Causes</h1>
      <span className="text-sm text-gray-600">
        Cause areas the projects we fund most often fit into.
      </span>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {regularCauses.map((cause) => (
          <CauseCard key={cause.slug} cause={cause} />
        ))}
      </div>
    </div>
  )
}

function CauseCard(props: { cause: FullCause; active?: boolean }) {
  const { cause, active } = props
  const numProjects = cause.projects.filter(
    (project) => project.stage !== 'hidden' && project.stage !== 'draft'
  ).length
  return (
    <Link
      className={
        active
          ? 'relative rounded bg-white shadow-md ring-2 ring-orange-500'
          : 'relative rounded bg-white shadow-md'
      }
      href={`/causes/${cause.slug}`}
    >
      <Image
        src={cause.header_image_url}
        width={240}
        height={120}
        className="relative aspect-[3/1] w-full flex-shrink-0 rounded-t bg-white object-cover sm:aspect-[5/3]"
        alt="round header image"
      />
      {active && <Tag text="OPEN TO PROPOSALS" color="orange" className="absolute left-2 top-2" />}
      <p className="px-4 pb-10 pt-2 font-semibold leading-tight lg:text-lg">{cause.title}</p>
      <p className="absolute bottom-2 right-4 text-xs text-gray-600 sm:text-sm">
        {numProjects} projects
      </p>
    </Link>
  )
}
