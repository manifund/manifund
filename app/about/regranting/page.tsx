import { getRegranters } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { RegrantorsDisplay } from './regrantors-display'
import { ExampleRegrants } from './example-regrants'

const DonationCTA = () => (
  <div className="my-8 text-center">
    <a
      href="mailto:hi@manifund.org"
      className="inline-block rounded-lg bg-orange-600 px-6 py-3 text-white hover:bg-orange-700"
    >
      Donate to AI Safety Regranting
    </a>
  </div>
)

export default async function RegrantingPage() {
  const supabase = await createServerSupabaseClient()
  const regrantors = await getRegranters(supabase)
  return (
    <div className="mx-auto max-w-3xl p-5">
      <div className="prose mx-auto max-w-none font-light">
        <h1>AI Safety Regranting</h1>
        <p>
          We partner with <i>regrantors:</i> experts in the field of AI safety, each given an
          independent budget. Regrantors recommend grants based on their personal expertise;
          Manifund reviews these recommendations and distributes the funds.
        </p>
        {/* <p>
          This model was pioneered by the FTX Future Fund; among the grantmaking
          models they experimented with in 2022, they{' '}
          <a href="https://forum.effectivealtruism.org/posts/paMYXYFYbbjpdjgbt/future-fund-june-2022-update#Expectations_vs__reality">
            considered regranting to be the most promising.
          </a>
        </p> */}
      </div>
      <DonationCTA />
      <RegrantorsDisplay regrantors={regrantors} />

      <div className="prose mx-auto max-w-none font-light">
        <h3>Why regranting?</h3>
        <ul>
          <li>
            <strong>Hidden opportunities:</strong> Regrantors can tap into their personal networks,
            giving to places that donors and grantmaking organizations might miss. Rather than wait
            for an application, regrantors can reach out to grantees to initiate new projects.
          </li>
          <li>
            <strong>Fast:</strong> The regrantor is responsible for the budget, rather than a
            committee. The regranting model requires less overhead than traditional grantmaking, so
            we can make grants in days, not months.
          </li>
          <li>
            <strong>Flexible:</strong> Regrantors can give to projects that are not yet registered
            as charities, or to individuals; Manifund acts as the fiscal sponsor, complying with
            501c3 requirements and allowing tax benefits for donors.
          </li>
          <li>
            <strong>Trust-based:</strong> Newer fields like AI safety can be speculative, opaque,
            and nascent, making it harder for donors to know where to direct their money. Regranting
            helps donors to outsource these decisions to individuals with deep expertise.
          </li>
        </ul>
        <p>
          Our regranting program is inspired by the success of programs like{' '}
          <a href="https://forum.effectivealtruism.org/posts/paMYXYFYbbjpdjgbt/future-fund-june-2022-update#Expectations_vs__reality">
            the Future Fund&apos;s regrants
          </a>
          ,{' '}
          <a href="https://survivalandflourishing.fund/speculation-grants.html">
            SFF&apos;s speculation grants
          </a>
          , and <a href="https://fastgrants.org/">Fast Grants</a>.
        </p>

        <h3>Example regrants</h3>
      </div>
      <ExampleRegrants regrantors={regrantors} />

      <div className="prose mx-auto max-w-none font-light">
        <h3>How does regranting on Manifund work?</h3>
        <ol>
          <li>
            A donor adds money to their Manifund account (which constitutes a tax-deductible
            donation to our 501c3 nonprofit).
          </li>
          <li>
            The donor can then allocate the money between regrantors of their choice (or they can
            give directly to projects).
          </li>
          <li>
            Regrantors choose which opportunities, including projects posted on Manifund through our
            open call or projects they learn about elsewhere, to spend their budgets on, writing up
            an explanation for each grant made.
          </li>
          <li>
            We review the grant to make sure it is legitimate, legal, and aligned with our mission.
          </li>
          <li>
            If we approve the grant, the money will be transferred to the grantee&apos;s Manifund
            account, at which point they request to withdraw and we send them their funds.
          </li>
        </ol>
        <h3>FAQ</h3>
        <strong>Who can see the information about grants?</strong>
        <br />
        <p>
          Currently all grant information is made public. This includes the identity of the
          regrantor and grant recipient, the project description, the grant size, and the
          regrantor’s writeup.
        </p>
        <p>
          We strongly believe in transparency as it allows for meaningful public feedback,
          accountability of decisions, and establishment of a regrantor track records. We recognize
          that not all grants are suited for publishing; for now, we recommend such grants be made
          through other funders, such as the Long Term Future Fund, the Survival and Flourishing
          Fund, or Open Philanthropy.
        </p>
        <strong>What kinds of projects are eligible for regranting?</strong>
        <br />
        <p>
          We have no official cause-area restrictions on grants, though most of our regrantors are
          focused on mitigating global catastrophic risk, specifically on AI safety.
        </p>
        <p>
          We support regrants to registered charities and individuals. For-profit organizations may
          also be eligible, pending due diligence. As a US-registered 501c3, we do not generally
          permit donations to political campaigns or lobbying.
        </p>
        <p>
          We look over all grants before fulfilling withdrawal requests to make sure they meet these
          requirements. We reserve the right to veto grants for any reason, though we expect to
          often defer to our regrantors’ judgement.
        </p>
        <strong>Can regrantors send money to their own projects?</strong>
        <br />
        <p>
          In certain circumstances, we allow regrantors to give to projects they advise, or are
          otherwise involved with; we evaluate these projects with a more rigorous bar before
          fulfilling withdrawal requests. We generally do not permit regrantors to pay for their own
          salaries.
        </p>
        <strong>Can I contribute funds to the regrantor budgets?</strong>
        <p>
          Yes! We&apos;re looking for contributions to our AI Safety regrantor budgets. If
          you&apos;re donating a substantial amount (eg $50k+), we can also work with you to
          nominate specific regrantors who share your values and interests. We do ask large donors
          to cover a 5% fiscal sponsorship fee, which offsets our operational costs & salaries.
        </p>
        <p>Get in touch (hi@manifund.org) if you&apos;re interested in donating!</p>
      </div>
      <DonationCTA />
    </div>
  )
}
