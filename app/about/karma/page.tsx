import Link from 'next/link'
import { KARMA_CONFIG } from '@/utils/karma'

export const metadata = {
  title: 'Karma',
  description: 'How Manifund karma is calculated and how it orders the homepage.',
}

// Every number on this page comes from KARMA_CONFIG so it can't drift from the formula.
export default function KarmaPage() {
  const c = KARMA_CONFIG
  const tipList = Object.entries(c.tippedReactMultipliers)
    .map(([emoji, mult]) => `${emoji} ×${mult}`)
    .join(', ')
  return (
    <div className="p-5">
      <div className="prose mx-auto font-light">
        <h1>Karma</h1>
        <p>
          Karma is a rough signal of whether you&apos;ve made valuable contributions to Manifund and
          its community, or are trusted by people who have. It is shown on profiles and projects,
          and it decides the order of the homepage. It is recomputed about once an hour.
        </p>

        <h2>Your karma</h2>
        <p>
          Everyone starts with {c.startingKarma} karma. On top of that, your karma is the sum of:
        </p>
        <ul>
          <li>
            <strong>Donations you&apos;ve given.</strong> For each project you donate to,{' '}
            {c.donationScale} × (total given)<sup>{c.donationExponent}</sup>, so $100 is worth about{' '}
            {Math.round(c.donationScale * 100 ** c.donationExponent)} and $10,000 about{' '}
            {Math.round(c.donationScale * 10000 ** c.donationExponent)}. Money committed to a
            proposal before it reached its minimum funding is worth {c.earlyDonationMultiplier}× as
            much.
          </li>
          <li>
            <strong>Donations your projects received.</strong> The same formula, applied to each
            donor&apos;s total to one of your projects.
          </li>
          <li>
            <strong>Votes on your projects.</strong> Each upvote is worth log
            <sub>{c.weightLogBase}</sub>
            (voter&apos;s karma): 1 point from someone with {c.weightLogBase} karma, 2 from someone
            with {c.weightLogBase ** 2}, 3 from someone with {c.weightLogBase ** 3}. Downvotes
            subtract the same amount. Your own vote on your own project doesn&apos;t count.
          </li>
          <li>
            <strong>Reactions to your comments.</strong> Positive reactions (
            {c.positiveReacts.join(' ')}) are weighted by the reactor&apos;s karma in the same way,
            then multiplied by {c.reactMultiplier}. Tipped reactions are worth more: {tipList}.
          </li>
        </ul>
        <p>
          Because vote weight depends on the voter&apos;s karma, which depends on votes on their own
          projects, we compute everyone&apos;s karma together and iterate until it settles.
        </p>

        <h2>Project karma</h2>
        <p>A project&apos;s karma is the sum of:</p>
        <ul>
          <li>
            A starting value of {c.projectBaseKarma}, so new projects get a brief run near the top.
          </li>
          <li>Votes, weighted by each voter&apos;s karma as above.</li>
          <li>
            Comments by people other than the creator, weighted by the commenter&apos;s karma.
          </li>
          <li>Donations: the same dollar formula, applied to each donor&apos;s total.</li>
          <li>
            A prior from the creator: {c.creatorKarmaCoefficient} × log<sub>10</sub>(1 + the
            creator&apos;s karma beyond their starting {c.startingKarma}).
          </li>
        </ul>

        <h2>Homepage order</h2>
        <p>
          The homepage sorts projects by karma divided by (age in days + 1)
          <sup>{c.hotAgeExponent}</sup>, so a project needs ongoing engagement to stay near the top.
          Projects that are no longer accepting donations (complete, not funded, or a grant that has
          reached its funding goal) are multiplied by {c.closedProjectMultiplier} in this sort only;
          their karma is unchanged.
        </p>

        <h2>What doesn&apos;t count</h2>
        <ul>
          <li>Hidden and draft projects.</li>
          <li>Donations to yourself, and transfers from Manifund&apos;s own accounts.</li>
          <li>Investments in impact certificates (only donations count, for now).</li>
          <li>Reacting to your own comments.</li>
        </ul>
        <p>
          Individual votes and reactions remain private. Questions or ideas? Reach us at{' '}
          <Link href="mailto:hello@manifund.org">hello@manifund.org</Link>.
        </p>
      </div>
    </div>
  )
}
