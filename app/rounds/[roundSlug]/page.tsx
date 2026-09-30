import { createServerSupabaseClient } from '@/db/supabase-server'
import { getRoundBySlug } from '@/db/round'
import { getFullProjectsByRound } from '@/db/project'
import { RoundTabs } from './round-tabs'
import { RoundData } from '@/components/round-data'
import Image from 'next/image'
import { getRegranters } from '@/db/profile'
import { listSimpleCauses } from '@/db/cause'
import { notFound } from 'next/navigation'

export const revalidate = 60

export async function generateMetadata(props: { params: Promise<{ roundSlug: string }> }) {
  const { roundSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const round = await getRoundBySlug(supabase, roundSlug)
  return {
    title: round?.title ?? 'Round not found',
  }
}

export default async function RoundPage(props: { params: Promise<{ roundSlug: string }> }) {
  const { roundSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const round = await getRoundBySlug(supabase, roundSlug)
  if (!round) {
    notFound()
  }
  const [projects, regranters, causesList] = await Promise.all([
    getFullProjectsByRound(supabase, round.title),
    round.title === 'Regrants' ? getRegranters(supabase) : [],
    listSimpleCauses(supabase),
  ])
  const visibleProjects = projects.filter((project) => project.stage !== 'hidden')
  return (
    <div className="bg-dark-200 max-w-4xl">
      {round.header_image_url && (
        <Image
          src={round.header_image_url}
          width={1000}
          height={500}
          className="relative aspect-[4/1] w-full flex-shrink-0 rounded bg-white object-cover"
          alt="round header image"
        />
      )}
      <h1 className="my-2 text-4xl font-bold">{round.title}</h1>
      <div className="mx-5 my-5">
        <RoundData round={round} projects={visibleProjects} />
      </div>
      <RoundTabs
        round={round}
        projects={visibleProjects}
        causesList={causesList}
        regranters={round.title === 'Regrants' ? regranters : undefined}
      />
    </div>
  )
}
