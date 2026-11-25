import { SectionNav } from '@/components/section-nav'
import {
  HeaderSkeleton,
  RailSkeleton,
  SectionSkeleton,
} from '@/app/[usernameSlug]/sections/skeletons'

const SECTIONS = ['About', 'Projects', 'Comments', 'Donations', 'Transactions'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))

// Shown at once when someone opens a profile, until the header arrives; then the sections stream in.
export default function Loading() {
  return (
    <div className="px-4 pb-16 pt-7 font-light">
      <div className="h-[18px]" />
      <div className="mt-5">
        <HeaderSkeleton />
      </div>
      <SectionNav sections={SECTIONS} />
      <div className="flex flex-col gap-7 pt-7 xl:flex-row xl:items-start">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-16 xl:order-1">
          <SectionSkeleton id="about-loading" shape="text" />
          <SectionSkeleton id="projects-loading" title="Projects" shape="cards" />
        </div>
        <div className="order-1 xl:order-2 xl:w-80 xl:flex-none">
          <RailSkeleton />
        </div>
      </div>
    </div>
  )
}
