import Link from 'next/link'
import clsx from 'clsx'
import { Avatar } from '@/components/avatar'
import { buttonClass } from '@/components/button'
import type { MiniProfile } from '@/db/profile'

// Sunlight Fund's About section, from the fund's announcement. Each part of the ethos is paired with the
// reason it's called Sunlight.
const ETHOS = [
  {
    title: 'Fast',
    light: 'Sunlight crosses vast distances to reach Earth in just 8 minutes.',
    body: 'Given rapid AI progress, delays of months waiting for funders to decide on grants are costly. We’ll make grants within a week or less. From running Manifund, we have experience getting money out the door to grantees quickly.',
  },
  {
    title: 'Transparent',
    light: '“Sunlight is the best disinfectant.”',
    body: 'All applications, grants and reasoning are public in real time, so you can see exactly what we fund, when and why, instead of trusting us blindly. We think this is a public good, too: it tells others what is getting funded.',
  },
  {
    title: 'Early-stage',
    light: 'Sunlight nurtures and incubates seedlings.',
    body: 'Large, established orgs with plenty of runway don’t need the money as much as projects just starting up, and existing funders already serve them well. We expect check sizes of $1k to $50k; this may grow with more funding.',
    link: {
      href: 'https://manifund.substack.com/p/when-you-donate-can-matter-more-than',
      text: 'When you donate can matter more than where',
    },
  },
  {
    title: 'AI safety',
    light: 'Sunlight is warm and makes people happy.',
    body: 'We grant within the basic framework that transformative AI is likely coming soon, and making it go well is very important. Most grants will target existential risk from AI, but some may go to the welfare of digital minds or to making the post-transformative-AI future go well.',
  },
]

const INTERESTS: { username: string; name: string; items: string[] }[] = [
  {
    username: 'Austin',
    name: 'Austin',
    items: [
      'Software',
      'Forecasting and epistemics',
      'Fieldbuilding',
      'Writing and media',
      'Trade and cooperation with AIs',
    ],
  },
  {
    username: 'carol',
    name: 'Caroline',
    items: [
      'Thinking on how to make the future go well, and turning it into policy',
      'Media',
      'Advocacy for pausing or pacing AI',
      'Movement-building and fieldbuilding',
      'Community infrastructure',
      'Small technical alignment grants, betting on the person more than the research',
      'Cooperation with AIs',
      'Philosophy on strange ideas that might matter',
    ],
  },
]

export function SunlightAbout(props: { admins: MiniProfile[]; applySlug?: string }) {
  const { admins, applySlug } = props
  const h2 = 'text-2xl font-normal tracking-tight text-gray-900'
  const prose = 'max-w-[68ch] text-[15px] leading-relaxed text-gray-700'
  return (
    <div className="flex flex-col gap-14">
      <p className="max-w-[60ch] text-pretty text-xl font-light leading-relaxed text-gray-800">
        Lots of people want to give money to AI safety, and lots of projects need money, but
        matching them up is far from solved. Many funding opportunities are built for large donors
        and grantees, keep their information private, and move slowly. Sunlight Fund, run by Austin
        Chen and Caroline Ellison, is here to fill that gap.
      </p>

      <section className="flex flex-col gap-6">
        <h2 className={h2}>How we grant</h2>
        <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {ETHOS.map((part) => (
            <div key={part.title} className="border-l-2 border-amber-400 pl-5">
              <dt className="text-lg font-normal text-gray-900">{part.title}</dt>
              <dd className="mt-1 text-sm italic text-amber-800">{part.light}</dd>
              <dd className="mt-2.5 text-[15px] leading-relaxed text-gray-700">
                {part.body}
                {part.link && (
                  <>
                    {' '}
                    More in{' '}
                    <a href={part.link.href} className="text-orange-600 hover:underline">
                      {part.link.text}
                    </a>
                    .
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className={h2}>What we’re excited to fund</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {INTERESTS.map((person) => {
            const admin = admins.find((a) => a.username === person.username)
            return (
              <div key={person.username} className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  {admin && (
                    <Avatar
                      username={admin.username}
                      avatarUrl={admin.avatar_url}
                      id={admin.id}
                      size={10}
                    />
                  )}
                  <Link
                    href={`/${person.username}`}
                    className="text-lg font-normal text-gray-900 hover:underline"
                  >
                    {person.name}
                  </Link>
                </div>
                <ul className="mt-4 flex flex-col gap-2 text-[15px] leading-snug text-gray-700">
                  {person.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-amber-400"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h2}>Apply for a grant</h2>
        <p className={prose}>
          Applications are public project proposals on Manifund. We aim to reply to every applicant
          within a week through the end of the year, then we’ll take stock.
        </p>
        {applySlug ? (
          <Link
            href={`/create?prize=${applySlug}`}
            className={clsx(buttonClass('lg', 'orange'), 'w-fit')}
          >
            Start an application
          </Link>
        ) : (
          <p className="w-fit rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            Applications open soon.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className={h2}>Who should donate</h2>
        <blockquote className="max-w-[62ch] border-l-2 border-amber-400 pl-5 text-lg font-light italic leading-relaxed text-gray-800">
          “I’m planning to donate $10–100k this year. In the past, I’ve donated to GiveWell: I trust
          them and I think they do good work identifying the top charities. I’m increasingly
          convinced that mitigating risk from advanced AI is a better donation target, but there’s
          no GiveWell equivalent and I don’t know what to donate to. I don’t want to spend a ton of
          effort evaluating opportunities. I get the sense that there’s lots of money floating
          around, and more coming, and maybe AI safety orgs just don’t need my money?”
        </blockquote>
        <p className={prose}>
          We’ve heard this from many people lately, and we hope Sunlight Fund can be the answer. If
          you’d have wanted to back{' '}
          <Link href="/Austin" className="text-orange-600 hover:underline">
            Austin’s past grants as a regrantor
          </Link>
          , you’ll probably want to back this fund.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h2}>How to donate</h2>
        <p className={prose}>
          Use the donate box on this page. Manifund takes card, bank transfer (ACH or wire), crypto
          and donor-advised funds; for anything but card,{' '}
          <a
            href="mailto:hi@manifund.org?subject=Donating%20to%20Sunlight%20Fund"
            className="text-orange-600 hover:underline"
          >
            email hi@manifund.org
          </a>
          . Manifund keeps 5% of donations to the fund to cover grantmaking, operations and fiscal
          sponsorship.
        </p>
      </section>
    </div>
  )
}
