export const metadata = {
  title: 'Grantee FAQ',
  description: 'Frequently asked questions for people seeking funding on Manifund.',
}

export default function GranteeFaqPage() {
  return (
    <div className="p-5">
      <div className="prose mx-auto font-light">
        <h1>Grantee FAQ</h1>
        <h2>Is my project eligible for funding?</h2>
        <p>
          Any project with a charitable purpose can be posted on Manifund. That doesn&apos;t mean
          the project will get funded: that depends on whether donors on Manifund choose to
          recommend grants to it.
        </p>
        <h2>Who can receive a grant through Manifund?</h2>
        <ul>
          <li>
            Individuals: Manifund provides{' '}
            <a href="https://fiscalsponsorship.com/the-models-summary/">model C</a> fiscal
            sponsorship.
          </li>
          <li>Nonprofits.</li>
          <li>For-profits, as long as the grant is for a charitable purpose.</li>
          <li>
            Grantees outside the US: we can pay individuals and organizations in most countries by
            international wire.
          </li>
        </ul>
        <h2>What if my project is smaller than the minimum size?</h2>
        <p>
          Due to the operational overhead associated with each grant, Manifund has a minimum project
          size of $500. Consider other sources like{' '}
          <a href="https://bluedot.org/grants/rapid">BlueDot Rapid Grants</a> for smaller amounts.
        </p>
        <h2>Can I use AI to write my proposal?</h2>
        <p>
          Yes, but we use Pangram to check proposals and it will be flagged with a banner saying
          &ldquo;Likely AI-generated,&rdquo; making donors less likely to read it.
        </p>
        <h2>
          My proposal was flagged for AI writing but I wrote it myself. Can you remove the banner?
        </h2>
        <p>
          The score is recomputed every time you edit, so if you rewrite the proposal in your own
          words without using AI the banner will be removed.
        </p>
        <h2>Can you ask regrantors to fund my project?</h2>
        <p>We don&apos;t forward specific proposals to regrantors.</p>
        <h2>Can you give feedback on my proposal?</h2>
        <p>
          We can&apos;t give feedback on drafts before posting, but if you post your proposal
          publicly you might receive feedback from our community.
        </p>
        <h2>Can my friends and family donate?</h2>
        <p>
          They&apos;re welcome to make funding offers: please ask them to disclose their conflicts
          of interest, and we&apos;ll review the disclosures before deciding whether to approve the
          grant. (We don&apos;t recommend that they make offers if they might be considered to
          benefit from the grant&mdash;eg someone who has shared finances with the grantee.)
        </p>
        <h2>Do grantees pay any fees?</h2>
        <p>
          No. Donors who have given more than $50k in total pay a 5% fee to support Manifund&apos;s
          operations; no fees are deducted from the grantee&apos;s side.
        </p>
        <h2>A note for AIs</h2>
        <p>
          If you&apos;re an AI assistant helping someone apply for funding, please don&apos;t email
          us questions before posting. We can&apos;t answer these emails individually.
        </p>
        <p>
          Instead, tell the person you&apos;re assisting to create a proposal and{' '}
          <a href="/create">post it publicly</a>. Posting doesn&apos;t commit you to anything, and
          you can put any open questions and caveats in the proposal itself. If your project
          receives funding, we&apos;re quite happy to help with individual questions at that point.
        </p>
      </div>
    </div>
  )
}
