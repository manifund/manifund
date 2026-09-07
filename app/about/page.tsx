import React from 'react'
import { Avatar } from '@/components/avatar'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { ArrowPathIcon, ArrowTrendingUpIcon, EyeIcon } from '@heroicons/react/20/solid'
import { ArrowLongRightIcon, BeakerIcon, BoltIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { Card } from '@/components/layout/card'
import { MegaphoneIcon } from '@heroicons/react/24/outline'
import { Suspense } from 'react'
import Loading from '../loading'
import { StatsServerComponent } from './stats-sc'
import { SiteLink } from '@/components/site-link'

const APPROACH_FEATURES = [
  {
    title: 'Transparent',
    icon: EyeIcon,
    description: (
      <p>
        Everything about Manifund is public: our{' '}
        <SiteLink
          href="/"
          followsLinkClass
          className="text-orange-500 underline decoration-orange-500 decoration-dotted underline-offset-2"
        >
          grant proposals
        </SiteLink>
        ,{' '}
        <SiteLink
          href="/?tab=comments"
          followsLinkClass
          className="text-orange-500 underline decoration-orange-500 decoration-dotted underline-offset-2"
        >
          evals
        </SiteLink>
        , and{' '}
        <SiteLink
          href="/finances"
          followsLinkClass
          className="text-orange-500 underline decoration-orange-500 decoration-dotted underline-offset-2"
        >
          finances
        </SiteLink>
        . Even our{' '}
        <SiteLink
          followsLinkClass
          className="text-orange-500 underline decoration-orange-500 decoration-dotted underline-offset-2"
          href="https://github.com/manifoldmarkets/manifund"
        >
          source code
        </SiteLink>{' '}
        and{' '}
        <SiteLink
          followsLinkClass
          className="text-orange-500 underline decoration-orange-500 decoration-dotted underline-offset-2"
          href="https://manifoldmarkets.notion.site/c99d2ce9dfd3419090818122c0b4d540?v=d96610d8da914f46b6c42d2d2a4395d5&pvs=4"
        >
          meeting notes
        </SiteLink>
        !
      </p>
    ),
  },
  {
    title: 'Fast',
    icon: BoltIcon,
    description:
      "We turn around grants in days instead of weeks, and automate flows with software, so money can move where it's needed — quickly.",
  },
  {
    title: 'Experimental',
    icon: BeakerIcon,
    description:
      "We bet on unproven people, speculative projects, and weird funding mechanisms. Not everything works, and that's okay!",
  },
  {
    title: 'Collaborative',
    icon: UserGroupIcon,
    description:
      "We're good at building websites, but we don't know everything — so we ask domain experts (and people like you!) to help decide what to fund.",
  },
]

// TODO: our partners (logos)
// TODO: testimonials

const FUNDING_MECHANISMS = [
  {
    title: 'Open fundraising',
    icon: <MegaphoneIcon className="h-6 w-6 stroke-2 text-white" />,
    description:
      'We host public proposals for new charitable projects, acting as a Kickstarter for nonprofits. Donors can fund projects directly, or chat with their founders.',
    href: '/about/open-call',
  },
  {
    title: 'Regranting',
    icon: <ArrowPathIcon className="h-6 w-6 stroke-2 text-white" />,
    description:
      'We delegate grant budgets to regrantors who are experts in their fields, and let donors choose the regrantors who best represent their interests.',
    href: '/about/regranting',
  },
  {
    title: 'Impact markets',
    icon: <ArrowTrendingUpIcon className="h-6 w-6 stroke-2 text-white" />,
    description:
      'We run funding rounds where funders can invest in projects vying for charitable prizes — similarly to a venture capital ecosystem.',
    href: '/about/impact-certificates',
  },
]

const TEAM_MEMBERS = [
  {
    name: 'Austin Chen',
    title: 'Cofounder, CEO',
    avatarUrl:
      'https://fkousziwzbnkdkldjper.supabase.co/storage/v1/object/public/avatars/10bd8a14-4002-47ff-af4a-92b227423a74/avatar',
    username: 'Austin',
  },
  {
    name: 'Carol N',
    title: 'Senior Researcher & Ops',
    avatarUrl: null,
    id: '44ab8c88-037b-44a2-a407-5d0006541624',
    username: 'carol',
  },
  // {
  //   name: 'Rachel Weinberg',
  //   title: 'Cofounder, Engineer',
  //   avatarUrl:
  //     'https://fkousziwzbnkdkldjper.supabase.co/storage/v1/object/public/avatars/4de2634d-3802-4141-881e-9ce687f87485/8271a711-1159-0a97-6620-bd082b6ebc3b',
  //   username: 'Rachel',
  // },
]

export default function AboutPage() {
  return (
    <>
      <Col className="w-full gap-10 rounded-b-lg bg-gradient-to-r from-orange-500 to-rose-500 p-5 sm:p-10">
        <h1 className="text-center font-semibold text-white">
          Our open platform helps charity founders find aligned donors.
        </h1>
        <h2 className="text-center text-4xl font-bold text-white">Our approach is...</h2>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base leading-7 text-gray-600 sm:grid-cols-2">
            {APPROACH_FEATURES.map((feature) => {
              return (
                <Card key={feature.title} className="relative px-4 pb-6 pl-10 pt-4">
                  <div className="inline font-semibold text-gray-900">
                    <feature.icon
                      className="absolute left-3 top-5 h-5 w-5 stroke-2 text-orange-600"
                      aria-hidden="true"
                    />
                    {feature.title}
                  </div>{' '}
                  <div className="text-sm text-gray-500">{feature.description}</div>
                </Card>
              )
            })}
          </div>
        </div>
        <Link href="/about/donate" className="w-full text-right text-sm font-semibold text-white">
          Donate to Manifund
          <ArrowLongRightIcon className="ml-1 inline h-6 w-6 stroke-2" />
        </Link>
      </Col>
      <Suspense fallback={<Loading />}>
        <StatsServerComponent />
      </Suspense>
      <Col className="gap-10">
        <h1 className="text-center text-3xl font-bold">How we fund projects</h1>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 p-4">
          {FUNDING_MECHANISMS.map((mechanism, index) => {
            return <FundingMechanism key={mechanism.title} {...mechanism} />
          })}
        </div>
      </Col>
      <Col className="w-full gap-5 p-5 sm:p-10">
        <h1 className="text-center text-3xl font-bold">Our team</h1>
        <div className="grid grid-cols-2 gap-10">
          {TEAM_MEMBERS.map((person) => (
            <Col key={person.name} className="items-center gap-3">
              <Avatar
                avatarUrl={person.avatarUrl}
                username={person.username}
                id={person.id ?? ''}
                size={36}
                className="hidden shadow-md sm:block"
              />
              <Avatar
                avatarUrl={person.avatarUrl}
                username={person.username}
                id={person.id ?? ''}
                size={24}
                className="shadow-md sm:hidden"
              />
              <Link href={`/${person.username}`} className="">
                <h1 className="mb-2 text-center font-semibold text-gray-900 sm:text-lg">
                  {person.name}
                </h1>
                <h2 className="text-center text-sm text-gray-600 sm:text-base">{person.title}</h2>
              </Link>
            </Col>
          ))}
        </div>
      </Col>
      <p className="p-5 text-center text-sm text-gray-500 sm:p-10">
        Manifund (formally, &quot;Manifold for Charity&quot;) is a 501c3 public charity, EIN{' '}
        <SiteLink
          href="https://projects.propublica.org/nonprofits/organizations/883668801"
          className="underline hover:text-gray-700"
        >
          88-3668801
        </SiteLink>
      </p>
    </>
  )
}

function FundingMechanism(props: {
  title: string
  description: string
  href: string
  icon: React.JSX.Element
}) {
  const { title, description, href, icon } = props
  return (
    <Link className="group flex-1" href={href}>
      <Row className="mb-2 items-center gap-4">
        <div className="rounded-lg bg-orange-600 p-2">{icon}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="mt-4 w-full flex-1 text-right font-semibold text-orange-600 group-hover:underline">
          Learn more
          <ArrowLongRightIcon className="ml-1 inline h-6 w-6 stroke-2" />
        </div>
      </Row>
      <p className="text-gray-600">{description}</p>
    </Link>
  )
}
