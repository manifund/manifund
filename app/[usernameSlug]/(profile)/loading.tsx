import { SectionNav } from '@/components/section-nav'
import { HeaderSkeleton, SectionSkeleton } from '@/app/[usernameSlug]/sections/skeletons'

const SECTIONS = ['About', 'Projects', 'Comments', 'Donations', 'Transactions'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))

// Shown at once when someone opens a profile, until the header arrives; then the sections stream in.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-7 font-light">
      <div className="h-[18px]" />
      <div className="mt-5">
        <HeaderSkeleton />
      </div>
      <SectionNav sections={SECTIONS} />
      <div className="flex flex-col gap-16 pt-8">
        <SectionSkeleton id="about-loading" shape="text" />
        <SectionSkeleton id="projects-loading" title="Projects" shape="cards" />
      </div>
    </div>
  )
}
