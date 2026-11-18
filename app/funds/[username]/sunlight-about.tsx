import Link from 'next/link'
import clsx from 'clsx'
import { Avatar } from '@/components/avatar'
import { buttonClass } from '@/components/button'
import type { MiniProfile } from '@/db/profile'

// Sunlight Fund's About section: the fund's announcement, as written, with each part of the ethos paired with
// its line from "Why Sunlight?".
const ETHOS: { title: string; light: string; body: React.ReactNode }[] = [
  {
    title: 'Fast',
    light: 'Sunlight crosses vast distances to reach Earth in just 8 minutes.',
    body: (
      <p>
        We believe given rapid AI progress, delays of months waiting for funders to decide on grants
        are quite costly. We’ll make grants within 1 week or less. From working on Manifund, we have
        experience in getting money out the door to grantees quickly.
      </p>
    ),
  },
  {
    title: 'Transparent',
    light: 'Sunlight is the best disinfectant.',
    body: (
      <p>
        All applications, grants, and reasoning will be public in real-time, so you can see exactly
        what grants are being made, when, and why. This allows donors to see what we’re doing rather
        than needing to blindly trust us. We also think this is a public good—it’s informative to
        others to see what projects are getting funded.
      </p>
    ),
  },
  {
    title: 'Early-stage',
    light: 'Sunlight nurtures and incubates seedlings.',
    body: (
      <>
        <p>
          We think the best way to donate effectively is to make fast grants to early-stage
          opportunities as they come up. Large, established orgs with plenty of runway don’t need
          the money as much as projects that are just starting up do, and existing funders already
          serve them well. See{' '}
          <a
            href="https://manifund.substack.com/p/when-you-donate-can-matter-more-than"
            className="text-orange-600 hover:underline"
          >
            When you donate can matter more than where
          </a>{' '}
          for more thoughts on this.
        </p>
        <p>
          Currently we expect check sizes to be in the range of $1k-$50k—this may grow if we get
          more funding.
        </p>
      </>
    ),
  },
  {
    title: 'AI safety',
    light: 'Sunlight is warm and makes people happy.',
    body: (
      <p>
        Our grants will be made within the basic framework that transformative AI is likely coming
        soon, and making it go well is very important. Most grants will probably target preventing
        existential risk from AI, but could also include things like the welfare of digital minds or
        making the post-transformative AI future go well.
      </p>
    ),
  },
]

const INTERESTS: { username: string; name: string; intro: string; items: string[] }[] = [
  {
    username: 'Austin',
    name: 'Austin',
    intro: 'probably:',
    items: [
      'software',
      'forecasting/epistemics',
      'fieldbuilding',
      'writing/media',
      'trade & cooperation with AIs',
    ],
  },
  {
    username: 'carol',
    name: 'Caroline',
    intro: 'I’m excited about grants funding:',
    items: [
      'thinking on how to make the future go well, and translating those ideas into policy',
      'media',
      'advocacy for pausing or pacing',
      'good movement-building and field-building',
      'good community infrastructure',
      'I don’t understand technical alignment research well, but I’m excited to make small grants betting more on the person than the specific research.',
      'cooperation with AIs',
      'philosophical thinking about weird ideas that might be important',
    ],
  },
]

export function SunlightAbout(props: { admins: MiniProfile[]; applySlug?: string }) {
  const { admins, applySlug } = props
  const h2 = 'text-2xl font-normal tracking-tight text-gray-900'
  const prose = 'max-w-[68ch] text-[15px] leading-relaxed text-gray-700'
  return (
    <div className="flex flex-col gap-14">
      <div className="flex max-w-[60ch] flex-col gap-4 text-pretty text-xl font-light leading-relaxed text-gray-800">
        <p>
          Many people want to give money to AI safety, and many projects need money, but matching
          these up is far from solved. A lot of current funding opportunities are optimized for
          large donors and grantees, are private about information, and move slowly.
        </p>
        <p>
          Through our work on Manifund, and related projects like Mox and Manifest, we often come
          across great early-stage opportunities, which just need a small amount to flourish.
          Sunlight aims to fill this need.
        </p>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className={h2}>More on our ethos</h2>
        <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {ETHOS.map((part) => (
            <div key={part.title} className="border-l-2 border-amber-400 pl-5">
              <dt className="text-lg font-normal text-gray-900">{part.title}</dt>
              <dd className="mt-1 text-sm italic text-amber-800">{part.light}</dd>
              <dd className="mt-2.5 flex flex-col gap-3 text-[15px] leading-relaxed text-gray-700">
                {part.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className={h2}>What types of grants are we interested in?</h2>
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
                <p className="mt-4 text-[15px] text-gray-500">{person.intro}</p>
                <ul className="mt-2 flex flex-col gap-2 text-[15px] leading-snug text-gray-700">
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
        <h2 className={h2}>How do I apply?</h2>
        <div className={prose}>
          <p>All applications are made as public project proposals on Manifund.</p>
          <p className="mt-3">
            We aim to get back to all applicants in 1 week or less, up to the end of the year. At
            that point, we’ll reevaluate.
          </p>
        </div>
        {applySlug ? (
          <Link
            href={`/create?prize=${applySlug}`}
            className={clsx(buttonClass('lg', 'orange'), 'w-fit')}
          >
            Apply for a grant
          </Link>
        ) : (
          <p className="w-fit rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            Applications open soon.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className={h2}>Who should donate</h2>
        <p className={prose}>We’ve heard from many people lately who fit this description:</p>
        <blockquote className="max-w-[62ch] border-l-2 border-amber-400 pl-5 text-lg font-light italic leading-relaxed text-gray-800">
          “I’m planning to donate $10-100k this year. In the past, I’ve donated to GiveWell: I trust
          them and I think they do good work identifying the top charities. I’m increasingly
          convinced that mitigating risk from advanced AI is a better donation target, but there’s
          no GiveWell equivalent and I don’t know what to donate to. I don’t want to spend a ton of
          effort evaluating opportunities. I get the sense that there’s lots of money floating
          around, and more coming, and maybe AI safety orgs just don’t need my money?”
        </blockquote>
        <div className={prose}>
          <p>We’re hoping the Sunlight Fund can be an answer to that.</p>
          <p className="mt-3">
            You can also see Austin’s grantmaking history as a regrantor at his profile:{' '}
            <Link href="/Austin" className="text-orange-600 hover:underline">
              https://manifund.org/Austin
            </Link>
            —whether you would have wanted to support his grants in the past might be a good
            indicator of whether you want to donate to this fund.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h2}>How do I donate?</h2>
        <div className={prose}>
          <p>
            You can donate at the top of the page: Manifund accepts donations via credit card, ACH,
            wire transfer, crypto, and DAFs.
          </p>
          <p className="mt-3">
            Manifund will take a 5% fee on donations to the fund to cover grantmaking, operations,
            and fiscal sponsorship.
          </p>
        </div>
      </section>
    </div>
  )
}
