import 'server-only'
import Link from 'next/link'
import React from 'react'

export const metadata = {
  title: 'AI Safety Funder Bulletin',
  description: 'A digest of funders in the AI safety space.',
}

const LAST_UPDATED = 'October 1, 2026'

const LINK = 'text-orange-600 underline decoration-orange-500 decoration-dotted underline-offset-2'

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={LINK} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  )
}

type Cell = { v: string; n?: number }

type Row = {
  name: string
  href?: string
  donated2025: Cell
  grants2025: Cell
  expected2026: Cell
  fte: string
  generalApps: boolean
  openRfps: boolean
  donations: boolean
}

const AT_A_GLANCE: Row[] = [
  {
    name: 'Coefficient Giving',
    href: 'https://coefficientgiving.org/',
    donated2025: { v: '$409M', n: 1 },
    grants2025: { v: '232', n: 2 },
    expected2026: { v: '$1B', n: 3 },
    fte: '75',
    generalApps: false,
    openRfps: true,
    donations: true,
  },
  {
    name: 'Longview Philanthropy',
    href: 'https://www.longview.org/',
    donated2025: { v: '$60M', n: 4 },
    grants2025: { v: '—' },
    expected2026: { v: '$200M', n: 5 },
    fte: '16',
    generalApps: false,
    openRfps: false,
    donations: true,
  },
  {
    name: 'OpenAI Foundation',
    href: 'https://openaifoundation.org/',
    donated2025: { v: '$0' },
    grants2025: { v: '0' },
    expected2026: { v: '$250M', n: 6 },
    fte: '3',
    generalApps: false,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Macroscopic',
    href: 'https://macroscopic.org/',
    donated2025: { v: '$30M', n: 7 },
    grants2025: { v: '—' },
    expected2026: { v: '$100M', n: 8 },
    fte: '11',
    generalApps: false,
    openRfps: true,
    donations: false,
  },
  {
    name: 'SFF',
    href: 'https://survivalandflourishing.fund/',
    donated2025: { v: '$35M', n: 9 },
    grants2025: { v: '88', n: 10 },
    expected2026: { v: '$65M', n: 11 },
    fte: '10',
    generalApps: true,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Lightcone Commons',
    href: 'https://www.lightconecommons.com/',
    donated2025: { v: '$0' },
    grants2025: { v: '0' },
    expected2026: { v: '$35M', n: 12 },
    fte: '2',
    generalApps: true,
    openRfps: false,
    donations: true,
  },
  {
    name: 'Schmidt Sciences',
    href: 'https://www.schmidtsciences.org/',
    donated2025: { v: '$10M', n: 13 },
    grants2025: { v: '27', n: 14 },
    expected2026: { v: '$20M', n: 15 },
    fte: '2',
    generalApps: false,
    openRfps: false,
    donations: false,
  },
  {
    name: 'AISTOF',
    donated2025: { v: '$15M', n: 16 },
    grants2025: { v: '—' },
    expected2026: { v: '$40M', n: 17 },
    fte: '1',
    generalApps: false,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Manifund',
    href: 'https://manifund.org/',
    donated2025: { v: '$6M', n: 18 },
    grants2025: { v: '144', n: 19 },
    expected2026: { v: '$8.8M', n: 20 },
    fte: '2',
    generalApps: true,
    openRfps: false,
    donations: true,
  },
  {
    name: 'BlueDot Impact',
    href: 'https://bluedot.org/',
    donated2025: { v: '$0', n: 21 },
    grants2025: { v: '0', n: 21 },
    expected2026: { v: '$9.9M', n: 22 },
    fte: '1',
    generalApps: true,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Transformative AI Fund (formerly LTFF)',
    href: 'https://funds.effectivealtruism.org/funds/transformative-ai',
    donated2025: { v: '$1.2M', n: 23 },
    grants2025: { v: '20', n: 23 },
    expected2026: { v: '$4M', n: 24 },
    fte: '1',
    generalApps: true,
    openRfps: false,
    donations: true,
  },
]

// Single source of truth for footnotes: `node` renders in the Notes list, `text`
// is the plain-text version shown in the hover tooltip on each superscript marker.
const NOTES: { node: React.ReactNode; text: string }[] = [
  {
    text: "Using public grants on https://coefficientgiving.org/funds for the Navigating Transformative AI Fund ($324.3M in 2025) and the GCR Opportunities Fund ($85.0M), totalling $409.3M as of October 1, 2026. The GCR Opportunities figure fell from $97.0M two weeks earlier, so grants appear to get re-dated or reclassified as well as added. I don't know what the total of nonpublic AIS grants was; their 2025 letter from the CEO says they directed over $1B across all cause areas in 2025.",
    node: (
      <>
        Using public grants on{' '}
        <A href="https://coefficientgiving.org/funds">https://coefficientgiving.org/funds</A>
        &nbsp;for the Navigating Transformative AI Fund ($324.3M in 2025) and the GCR Opportunities
        Fund ($85.0M), totalling $409.3M as of October 1, 2026. The GCR Opportunities figure fell
        from $97.0M two weeks earlier, so grants appear to get re-dated or reclassified as well as
        added. I don&apos;t know what the total of nonpublic AIS grants was; their{' '}
        <A href="https://coefficientgiving.org/research/2025-letter-from-the-ceo/">
          2025 letter from the CEO
        </A>{' '}
        says they directed over $1B across all cause areas in 2025.
      </>
    ),
  },
  {
    text: 'Filtering https://coefficientgiving.org/funds by year gives 189 grants in 2025 for the Navigating Transformative AI Fund and 43 for the GCR Opportunities Fund. These counts still grow as back-dated grants are published: the 2026 count for the Navigating Transformative AI Fund went from 73 to 75 over the two weeks to October 1, 2026.',
    node: (
      <>
        Filtering{' '}
        <A href="https://coefficientgiving.org/funds">https://coefficientgiving.org/funds</A> by
        year gives 189 grants in 2025 for the Navigating Transformative AI Fund and 43 for the GCR
        Opportunities Fund. These counts still grow as back-dated grants are published: the 2026
        count for the Navigating Transformative AI Fund went from 73 to 75 over the two weeks to
        October 1, 2026.
      </>
    ),
  },
  {
    text: "Per Luke Muehlhauser's post.",
    node: (
      <>
        Per{' '}
        <A href="https://forum.effectivealtruism.org/posts/B6d8Wzk4gNzHsXvdi/ai-safety-is-extremely-bottlenecked-on-grantmakers">
          Luke Muehlhauser&apos;s post
        </A>
        .
      </>
    ),
  },
  {
    text: 'Per this post from a Longview team member, they directed over $60M in 2025, more than 2x their 2024 figure. Their August 2026 COO job posting said "We directed over $75 million to high-impact organizations in 2025, and expect 2026 will be substantially bigger," but that figure covers all of Longview\'s giving rather than AI safety specifically. That posting has since been delisted and its URL now redirects to their careers page.',
    node: (
      <>
        Per{' '}
        <A href="https://forum.effectivealtruism.org/posts/aX8xLjCLd4LMDpTYL/longview-is-hiring-what-longview-is-like-from-my-perspective">
          this post from a Longview team member
        </A>
        , they directed over $60M in 2025, more than 2x their 2024 figure. Their August 2026 COO job
        posting said &ldquo;We directed over $75 million to high-impact organizations in 2025, and
        expect 2026 will be substantially bigger,&rdquo; but that figure covers all of
        Longview&apos;s giving rather than AI safety specifically. That posting has since been
        delisted and its URL now redirects to their{' '}
        <A href="https://www.longview.org/careers/">careers page</A>.
      </>
    ),
  },
  {
    text: 'Longview\'s hiring materials said "In 2026, we aim to move $200 million — making us the second largest funder in that field." That page has since been taken down; an archived copy survives. Re-checked across their sitemaps on October 1, 2026: no live Longview page states a 2026 target. Their now-delisted COO posting said only that they expect 2026 to be "substantially bigger" than 2025.',
    node: (
      <>
        Longview&apos;s{' '}
        <A href="https://web.archive.org/web/20260520132637/https://www.longview.org/careers/people-operations-associate/">
          hiring materials
        </A>{' '}
        said &ldquo;In 2026, we aim to move $200 million — making us the second largest funder in
        that field.&rdquo; That page has since been taken down; an archived copy survives.
        Re-checked across their sitemaps on October 1, 2026: no live Longview page states a 2026
        target. Their now-delisted COO posting said only that they expect 2026 to be
        &ldquo;substantially bigger&rdquo; than 2025.
      </>
    ),
  },
  {
    text: 'Estimate: as of June 2026 they said they were working to finalize more than $130M in grants through their AI resilience program, "to be shared publicly soon and with more to come," and planning to invest more than $1B across several programs over the next year. The Foundation has still not published an AI resilience grantee list. Inside Philanthropy reported on September 29, 2026 that the Foundation has announced seven commitments totalling $815M across all programs and has "disbursed nearly $200 million" in grants, with over $750M in grant agreements approved.',
    node: (
      <>
        Estimate: as of June 2026 they{' '}
        <A href="https://openaifoundation.org/news/resilience-in-the-age-of-ai">said</A>
        &nbsp;they were working to finalize more than $130M in grants through their AI resilience
        program, &ldquo;to be shared publicly soon and with more to come,&rdquo; and planning to
        invest more than $1B across several programs over the next year. The Foundation has still
        not published an AI resilience grantee list.{' '}
        <A href="https://www.insidephilanthropy.com/home/the-openai-foundation-pledged-1-billion-in-a-year-hows-that-going-six-months-in">
          Inside Philanthropy
        </A>{' '}
        reported on September 29, 2026 that the Foundation has announced seven commitments totalling
        $815M across all programs and has &ldquo;disbursed nearly $200 million&rdquo; in grants,
        with over $750M in grant agreements approved.
      </>
    ),
  },
  {
    text: 'forum.effectivealtruism.org/topics/macroscopic-ventures',
    node: (
      <A href="https://forum.effectivealtruism.org/topics/macroscopic-ventures">
        https://forum.effectivealtruism.org/topics/macroscopic-ventures
      </A>
    ),
  },
  {
    text: 'Macroscopic\'s grants page says "This year, we plan to give up to $100m in total to organizations and individuals in our focus areas." Their job posting says they are deploying "up to $100+ million this year."',
    node: (
      <>
        <A href="https://macroscopic.org/grants">Macroscopic&apos;s grants page</A>
        &nbsp;says &ldquo;This year, we plan to give up to $100m in total to organizations and
        individuals in our focus areas.&rdquo; Their{' '}
        <A href="https://jobs.ashbyhq.com/macroscopic/0d80e3a8-2ffd-4bef-8485-03f764732a6e">
          job posting
        </A>{' '}
        says they are deploying &ldquo;up to $100+ million this year.&rdquo;
      </>
    ),
  },
  {
    text: 'survivalandflourishing.fund/2025/recommendations',
    node: (
      <A href="https://survivalandflourishing.fund/2025/recommendations">
        https://survivalandflourishing.fund/2025/recommendations
      </A>
    ),
  },
  {
    text: 'survivalandflourishing.fund/2025/recommendations',
    node: (
      <A href="https://survivalandflourishing.fund/2025/recommendations">
        https://survivalandflourishing.fund/2025/recommendations
      </A>
    ),
  },
  {
    text: 'SFF\'s 2026 Main Round recommendations say "The total funding recommended in this round is $64.58MM, exceeding our $14MM-$28MM estimate... The total funding expected to be distributed in association with this round is $65.08MM." That is the Main Round alone; the three themed rounds, estimated at $6-12MM in total, are still pending. Their application page had estimated "$20MM - $40MM in funding will collectively be distributed across all rounds and tracks."',
    node: (
      <>
        SFF&apos;s{' '}
        <A href="https://survivalandflourishing.fund/2026/recommendations">
          2026 Main Round recommendations
        </A>{' '}
        say &ldquo;The total funding recommended in this round is $64.58MM, exceeding our
        $14MM&ndash;$28MM estimate... The total funding expected to be distributed in association
        with this round is $65.08MM.&rdquo; That is the Main Round alone; the three themed rounds,
        estimated at $6&ndash;12MM in total, are still pending. Their{' '}
        <A href="https://survivalandflourishing.fund/2026/application">application page</A> had
        estimated &ldquo;$20MM - $40MM in funding will collectively be distributed across all rounds
        and tracks.&rdquo;
      </>
    ),
  },
  {
    text: 'Private communications',
    node: <>Private communications</>,
  },
  {
    text: 'schmidtsciences.org new $10M AI safety science program (foundational research)',
    node: (
      <A href="https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/">
        https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/
      </A>
    ),
  },
  {
    text: 'The February 2025 announcement says they selected 27 projects, and a July 2025 release puts it at "more than $10 million in grants to 27 research projects." Their Science of Trustworthy AI page also lists a second cohort of 21 inference-time-compute projects, for 48 in total, but publishes no award date or dollar total for those, so they are not counted here.',
    node: (
      <>
        The{' '}
        <A href="https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/">
          February 2025 announcement
        </A>{' '}
        says they selected 27 projects, and a{' '}
        <A href="https://www.schmidtsciences.org/schmidt-sciences-joins-global-research-effort-to-safeguard-ai/">
          July 2025 release
        </A>{' '}
        puts it at &ldquo;more than $10 million in grants to 27 research projects.&rdquo; Their{' '}
        <A href="https://www.schmidtsciences.org/trustworthy-ai/">Science of Trustworthy AI page</A>{' '}
        also lists a second cohort of 21 inference-time-compute projects, for 48 in total, but
        publishes no award date or dollar total for those, so they are not counted here.
      </>
    ),
  },
  {
    text: 'Estimate: totals for their 2026 AI safety RFPs were not published. The live page for the 2026 Science of Trustworthy AI RFP has since been taken down; an archived copy survives.',
    node: (
      <>
        Estimate: totals for their 2026 AI safety RFPs were not published. The live page for the{' '}
        <A href="https://web.archive.org/web/20260222153754/https://www.schmidtsciences.org/opportunity/2026-science-of-trustworthy-ai-rfp/">
          2026 Science of Trustworthy AI RFP
        </A>{' '}
        has since been taken down; an archived copy survives.
      </>
    ),
  },
  {
    text: "Estimate from Manifund's Trace database, which as of October 1, 2026 puts AISTOF's 2025 giving at $15.0M across 14 recorded grants ($13.5M of it an explicit estimate rather than itemised grants) and its 2026 giving at $25.0M across 29 ($22.3M of it an estimate). AISTOF publishes no figures of its own.",
    node: (
      <>
        Estimate from Manifund&apos;s <A href="https://trace.manifund.org/orgs/aistof">Trace</A>
        &nbsp;database, which as of October 1, 2026 puts AISTOF&apos;s 2025 giving at $15.0M across
        14 recorded grants ($13.5M of it an explicit estimate rather than itemised grants) and its
        2026 giving at $25.0M across 29 ($22.3M of it an estimate). AISTOF publishes no figures of
        its own.
      </>
    ),
  },
  {
    text: 'Private communications',
    node: <>Private communications</>,
  },
  {
    text: 'Around $5.9M donated in calendar 2025, per the data behind manifund.org/about (the page itself displays only all-time totals).',
    node: (
      <>
        Around $5.9M donated in calendar 2025, per the data behind{' '}
        <A href="https://manifund.org/about">manifund.org/about</A> (the page itself displays only
        all-time totals).
      </>
    ),
  },
  {
    text: 'Distinct projects that received funding in 2025, per the data behind manifund.org/about.',
    node: (
      <>Distinct projects that received funding in 2025, per the data behind manifund.org/about.</>
    ),
  },
  {
    text: 'Around $6.58M donated between January 1 and September 30, 2026, per the data behind manifund.org/about, extrapolated to a full year.',
    node: (
      <>
        Around $6.58M donated between January 1 and September 30, 2026, per the data behind{' '}
        <A href="https://manifund.org/about">manifund.org/about</A>, extrapolated to a full year.
      </>
    ),
  },
  {
    text: 'Treated as zero: their published list of rapid grants shows only 15 grants totalling $9,866 made between June and December 2025, negligible at the scale of this table. They began granting at scale in 2026, and Career Transition Grants only launched in May 2026.',
    node: (
      <>
        Treated as zero: their published list of{' '}
        <A href="https://bluedot.org/grants/rapid">rapid grants</A> shows only 15 grants totalling
        $9,866 made between June and December 2025, negligible at the scale of this table. They
        began granting at scale in 2026, and Career Transition Grants only launched in May 2026.
      </>
    ),
  },
  {
    text: 'Their grant pages reported 896 rapid grants ($2,471,253) and 86 career transition grants ($4,939,775) when checked on October 1, 2026 — the pages publish running totals with no as-of date — of which about $7.4M is 2026 giving, extrapolated here to a full year.',
    node: (
      <>
        Their grant pages reported <A href="https://bluedot.org/grants/rapid">896 rapid grants</A>{' '}
        ($2,471,253) and{' '}
        <A href="https://bluedot.org/grants/career-transition">86 career transition grants</A>{' '}
        ($4,939,775) when checked on October 1, 2026 — the pages publish running totals with no
        as-of date — of which about $7.4M is 2026 giving, extrapolated here to a full year.
      </>
    ),
  },
  {
    text: "LTFF grants recorded for 2025 in the EA Funds grants database. That database is incomplete: it lists 693 LTFF grants totalling $30.2M all-time, while the fund's own successor announcement says LTFF made 820+ grants totalling just under $35M since 2017. The payout chart on EA Funds' own fund pages shows the higher figure — 823 grants totalling $35.5M as of October 1, 2026 — so roughly 130 grants and $5.3M are missing from the public database. For 2025 specifically the two sources agree exactly, at 20 grants and $1,156,340.",
    node: (
      <>
        LTFF grants recorded for 2025 in the{' '}
        <A href="https://funds.effectivealtruism.org/grants">EA Funds grants database</A>. That
        database is incomplete: it lists 693 LTFF grants totalling $30.2M all-time, while the
        fund&apos;s own{' '}
        <A href="https://forum.effectivealtruism.org/posts/dYuNi5Rh68o9YKstg/ea-funds-is-launching-the-transformative-ai-fund">
          successor announcement
        </A>{' '}
        says LTFF made 820+ grants totalling just under $35M since 2017. The payout chart on EA
        Funds&apos; own fund pages shows the higher figure — 823 grants totalling $35.5M as of
        October 1, 2026 — so roughly 130 grants and $5.3M are missing from the public database. For
        2025 specifically the two sources agree exactly, at 20 grants and $1,156,340.
      </>
    ),
  },
  {
    text: 'The LTFF closed in August 2026 with around $3.7M left: roughly $2.8M for existing applicants, mostly through the first Lightcone Commons round, and around $0.9M seeding the Transformative AI Fund, which is fundraising for more.',
    node: (
      <>
        The LTFF{' '}
        <A href="https://forum.effectivealtruism.org/posts/dtZ9wbKWjtvGWDRJx/closing-the-ltff-spending-down-funds-and-a-new-ai-fund-at-ea">
          closed in August 2026
        </A>{' '}
        with around $3.7M left: roughly $2.8M for existing applicants, mostly through the first
        Lightcone Commons round, and around $0.9M seeding the Transformative AI Fund, which is
        fundraising for more.
      </>
    ),
  },
]

function Footnote({ n }: { n: number }) {
  return (
    <a
      href={`#note-${n}`}
      title={NOTES[n - 1]?.text}
      className="ml-0.5 align-super text-[0.65em] font-medium text-orange-600 no-underline hover:underline"
    >
      {n}
    </a>
  )
}

function NumCell({ cell }: { cell: Cell }) {
  return (
    <>
      {cell.v}
      {cell.n ? <Footnote n={cell.n} /> : null}
    </>
  )
}

function Check({ on }: { on: boolean }) {
  return on ? <span className="text-orange-600">✓</span> : <span className="text-gray-300">—</span>
}

function AtAGlanceTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left text-gray-500">
            <th className="p-2 font-semibold">Funder name</th>
            <th className="p-2 font-semibold">$ donated in 2025</th>
            <th className="p-2 font-semibold"># grants made in 2025</th>
            <th className="p-2 font-semibold">Expected $ donated in 2026</th>
            <th className="p-2 font-semibold">FTE</th>
            <th className="p-2 text-center font-semibold">General applications</th>
            <th className="p-2 text-center font-semibold">Open RFPs</th>
            <th className="p-2 text-center font-semibold">Accepting donations</th>
          </tr>
        </thead>
        <tbody>
          {AT_A_GLANCE.map((row) => (
            <tr key={row.name} className="border-b border-gray-100 align-top">
              <td className="p-2 font-medium">
                {row.href ? <A href={row.href}>{row.name}</A> : row.name}
              </td>
              <td className="p-2">
                <NumCell cell={row.donated2025} />
              </td>
              <td className="p-2">
                <NumCell cell={row.grants2025} />
              </td>
              <td className="p-2">
                <NumCell cell={row.expected2026} />
              </td>
              <td className="p-2">{row.fte}</td>
              <td className="p-2 text-center">
                <Check on={row.generalApps} />
              </td>
              <td className="p-2 text-center">
                <Check on={row.openRfps} />
              </td>
              <td className="p-2 text-center">
                <Check on={row.donations} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Funder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-gray-200 py-1">
      <summary className="cursor-pointer list-none py-2 font-semibold text-gray-900 marker:content-none">
        <span className="mr-2 inline-block text-orange-500 transition-transform group-open:rotate-90">
          ▸
        </span>
        {title}
      </summary>
      <div className="prose-sm pb-3 pl-6 text-sm text-gray-600 [&_a]:text-orange-600 [&_li]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </details>
  )
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group mt-12">
      <summary className="flex cursor-pointer list-none items-center text-2xl font-bold text-gray-900 marker:content-none">
        <span className="mr-2 inline-block text-orange-500 transition-transform group-open:rotate-90">
          ▸
        </span>
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

export default function AisFunderBulletinPage() {
  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-gray-900">
          AI Safety Funder Bulletin
        </h1>
        <p className="mb-6 text-sm text-gray-400">Last updated {LAST_UPDATED}</p>

        <div className="space-y-4 text-gray-600">
          <p>
            This is a digest of funders in the AI safety space. The goal is to give an overview of
            who is funding in the space that includes the most relevant information for people
            seeking funds, looking to donate, or looking to work in grantmaking.
          </p>
          <p>
            These tables are a rough summary of the numbers in the digest and the numbers are often
            best guesses based on public info; more detail is in the writeup and the footnotes. For
            funders that do work in multiple cause areas, it only considers grantmaking and staff
            focused on AIS. Some of the funding may repeat between rows—e.g. Coefficient donating to
            BlueDot or AISTOF making grants through Manifund—but this shouldn&apos;t substantially
            change the big-picture numbers.
          </p>
          <p>
            This is intended to be a living document that updates regularly. If you have any
            corrections, please reach out!
          </p>
        </div>

        <h2 className="mb-4 mt-10 text-2xl font-bold text-gray-900">At a glance</h2>
        <AtAGlanceTable />

        <h2 className="mb-2 mt-12 text-2xl font-bold text-gray-900">Funder profiles</h2>
        <p className="mb-4 text-sm text-gray-500">
          These are roughly sorted by money moved per year.
        </p>

        <div className="rounded-lg border border-gray-200">
          <div className="px-4">
            <Funder title="Coefficient Giving">
              <ul>
                <li>
                  <A href="https://coefficientgiving.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Previously Open Philanthropy, it grew out of a partnership between GiveWell
                      (founded in 2007 by Holden Karnofsky and Elie Hassenfeld) and Good Ventures
                      (foundation started in 2011 by Cari Tuna and Dustin Moskovitz). They&apos;re
                      mainly funded by Tuna and Moskovitz, but looking to work with more donors.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      The biggest funder in the space by far; AI safety is one of a dozen cause
                      areas they make grants in. Grants are usually sourced through their own
                      research rather than applications.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      donations: allocating{' '}
                      <A href="https://forum.effectivealtruism.org/posts/sHF2yjAnNNhxZ56jf/coefficient-giving-is-hiring-grantmakers-and-senior">
                        $1b to catastrophic risks in 2026
                      </A>
                    </li>
                    <li>grant sizes: $12k to $160m</li>
                    <li>
                      number of grants: the Navigating Transformative AI Fund lists 189 in 2025
                      ($324.3m) and 75 so far in 2026 ($240.6m); the GCR Opportunities Fund lists 43
                      ($85.0m) and 12 ($45.1m)
                    </li>
                    <li>
                      note that the public grants database understates their AI giving: their $160m
                      grant to Resolution, announced in July 2026, does not appear in it, and nor do
                      the Redwood Research grant of more than $70m over two years or the $10m for an
                      institute being established by Fields Medallist Jacob Tsimerman, both named in
                      their September 2026 scaling post. In September 2026 they said they committed{' '}
                      <A href="https://coefficientgiving.org/research/were-urgently-scaling-our-work-on-ai-and-biosecurity/">
                        $351m
                      </A>{' '}
                      across technical AI safety, security, and fieldbuilding in 2025 — more than
                      the $324.3m the database shows for the whole Navigating Transformative AI
                      Fund.
                    </li>
                    <li>
                      staff: 213 total. 43 of the 117 staff working on grants are on AI-focused
                      teams (technical AI safety, AI governance and international policy, US AI
                      policy, short timelines special projects, plus GCR capacity building and GCR
                      leadership), and I estimated 75 total by amortizing the staff working on
                      operations, communications, and partnerships.
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      On September 30, 2026 Joe Huston joined as their first{' '}
                      <A href="https://coefficientgiving.org/research/introducing-our-managing-director-of-philanthropic-advisory/">
                        Managing Director of Philanthropic Advisory
                      </A>
                      , leading the Partnerships team and their strategy for working with donors,
                      including the multi-donor funds and the advisory practice for major
                      philanthropists. He spent ten years at GiveDirectly, latterly as CFO and
                      Managing Director.
                    </li>
                    <li>
                      On September 9, 2026 they launched{' '}
                      <A href="https://coefficientgiving.org/tailwind/">Project Tailwind</A>, a call
                      for founders to launch new AI safety organizations — see Get involved below.
                      The same{' '}
                      <A href="https://coefficientgiving.org/research/were-urgently-scaling-our-work-on-ai-and-biosecurity/">
                        post
                      </A>{' '}
                      said their technical AI safety, security, and fieldbuilding commitments went
                      from $168m in 2024 to $351m in 2025 and are on track to pass $1b in 2026, with
                      $352m committed in August 2026 alone.
                    </li>
                    <li>
                      On September 4, 2026 they{' '}
                      <A href="https://coefficientgiving.org/funds/global-catastrophic-risks-opportunities/career-development-and-transition-funding/">
                        handed their career development and transition funding program to BlueDot
                        Impact
                      </A>
                      , along with a grant to support the work; applicants now go to BlueDot
                      instead. They will still process applications submitted on or before that
                      date.
                    </li>
                    <li>
                      In July 2026 they made a{' '}
                      <A href="https://www.alignmentforum.org/posts/HDKQNqiR2gtfMiWsn/announcing-our-usd160m-grant-from-coefficient-giving">
                        $160m grant to Resolution
                      </A>
                      , Geoffrey Irving&apos;s alignment research organization — $108m base plus
                      $52m conditional on hiring and compute needs. Coefficient is Resolution&apos;s
                      sole funder to start.
                    </li>
                    <li>
                      Their 2026 AI hiring rounds have closed, including the{' '}
                      <A href="https://coefficientgiving.org/about-us/careers/public-policy-hiring/">
                        DC-based roles in US AI policy
                      </A>{' '}
                      that were due August 2 and whose page is now titled &ldquo;[Closed].&rdquo; As
                      of October 2026 none of the three roles on their careers page is in
                      grantmaking or AI safety.
                    </li>
                    <li>
                      Caleb Watney, a cofounder of the Institute for Progress, joined in July 2026
                      as their first{' '}
                      <A href="https://coefficientgiving.org/research/introducing-our-new-managing-director-of-public-policy/">
                        Managing Director of Public Policy
                      </A>
                      , overseeing US AI policy among other areas.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding:
                      <ul>
                        <li>
                          They have open RFPs for:
                          <ul>
                            <li>
                              <A href="https://coefficientgiving.org/funds/navigating-transformative-ai/funding-for-work-that-builds-capacity-to-address-risks-from-transformative-ai/">
                                capacity-building
                              </A>{' '}
                              (e.g. training and mentorship programs, events, groups, coworking
                              spaces, media, online infrastructure, career advising) — decisions
                              within 3 months
                            </li>
                            <li>
                              <A href="https://coefficientgiving.org/funds/global-catastrophic-risks-opportunities/funding-for-programs-and-events-on-global-catastrophic-risk-effective-altruism-and-other-topics/">
                                programs and events
                              </A>{' '}
                              on global catastrophic risk, effective altruism, and related topics —
                              decisions within 3 months
                            </li>
                          </ul>
                          Their career development and transition funding RFP has closed: that
                          program moved to{' '}
                          <A href="https://bluedot.org/grants/career-transition">BlueDot Impact</A>{' '}
                          on September 4, 2026.
                        </li>
                        <li>
                          <A href="https://coefficientgiving.org/tailwind/">Project Tailwind</A>{' '}
                          (launched September 9, 2026) is a call for founders to start new AI safety
                          organizations targeting catastrophic risks, with a{' '}
                          <A href="https://coefficientgiving.org/tailwind/initiatives/">
                            list of initiatives
                          </A>{' '}
                          they want funded. Funding runs from pre-seed ($200k-$2m) through seed
                          ($2m-$20m) to scale ($20m-$200m+); express interest{' '}
                          <A href="https://coefficientgiving.org/tailwind/get-involved/">here</A>.
                          They automatically filter out submissions unrelated to catastrophic risks
                          from AI, or that appear AI-generated. There is no deadline, though they{' '}
                          <A href="https://coefficientgiving.org/tailwind/faqs/">say</A> they may
                          stop accepting submissions if they receive a large volume.
                        </li>
                        <li>
                          Their GCR capacity building team also takes a{' '}
                          <A href="https://op-gcrcb-general-form.paperform.co/">
                            general application
                          </A>{' '}
                          for work relevant to their goals that doesn&apos;t fit one of the programs
                          above.
                        </li>
                      </ul>
                    </li>
                    <li>
                      Donate: they are recruiting funders giving &gt; $250k/year; reach out to{' '}
                      <A href="mailto:partnerwithus@coefficientgiving.org">
                        partnerwithus@coefficientgiving.org
                      </A>
                    </li>
                    <li>
                      Apply for a job: as of October 2026 their{' '}
                      <A href="https://coefficientgiving.org/about-us/careers/">careers page</A>{' '}
                      lists three roles, all remote and none in grantmaking or AI safety: a
                      Salesforce Architect or Senior Architect and a Senior Salesforce Administrator
                      and Business Analyst (both posted August 25), and{' '}
                      <A href="https://jobs.ashbyhq.com/coefficientgiving/f4a244ab-7993-4752-9650-d86ae048dd5d">
                        multiple roles in AI x Global Health and Wellbeing
                      </A>{' '}
                      (posted September 16). Otherwise you can express interest there
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Longview Philanthropy">
              <ul>
                <li>
                  <A href="https://www.longview.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Founded in 2018 by barrister Natalie Cargill, who is now listed simply as
                      Founder; Simran Dhaliwal is CEO.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      Primarily a donor advisor: they design giving strategies for major
                      philanthropists and move most money via grant recommendations, alongside their
                      own funds (Frontier AI Fund, Digital Minds Fund, Nuclear Weapons Policy Fund,
                      and the Emerging Challenges Fund, which they are now closing).
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      donations: they directed over $75m in 2025 and say they expect 2026 to be
                      &ldquo;substantially bigger&rdquo;; their (now removed) hiring materials
                      earlier said they aimed to move $200m in 2026.
                    </li>
                    <li>
                      staff: 31 listed, 9 of them with AI program titles; around half the org
                      working on AIS gets 16. Two AI Program Officers (Aidan O&apos;Gara and Ajay
                      Karpur) dropped off the team listing in late September 2026, though their
                      profile pages are still live. Their now-delisted COO posting described them as
                      &ldquo;~35 people&rdquo; including accepted offers.
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      They ran two RFPs in 2026 that have now closed: one on{' '}
                      <A href="https://www.longview.org/request-for-proposals-on-extreme-power-concentration/">
                        extreme power concentration
                      </A>{' '}
                      ($100k–$2m/yr grants plus career funding, closed July 2) and one on{' '}
                      <A href="https://www.longview.org/request-for-proposals-research-and-applied-work-on-digital-minds/">
                        digital minds
                      </A>{' '}
                      (closed July 24). No grantees have been announced for either.
                    </li>
                    <li>
                      In August 2026 they announced they are{' '}
                      <A href="https://www.longview.org/fund/emerging-challenges-fund/">
                        closing the Emerging Challenges Fund
                      </A>
                      , their public fund, and are no longer accepting new donations to it.
                      Donations received through Giving What We Can by September 30, 2026 went into
                      a final grant round; that deadline has now passed, was not extended, and
                      Giving What We Can&apos;s own Emerging Challenges Fund page now redirects to
                      Longview&apos;s. They plan to publish a final grant report later in 2026. The
                      fund granted more than $3.5m from over 2,000 donors since launching in 2022.
                      They now point public donors to Giving What We Can&apos;s Risks and Resilience
                      Fund, though their{' '}
                      <A href="https://www.longview.org/fund/nuclear-weapons-policy-fund/">
                        Nuclear Weapons Policy Fund
                      </A>{' '}
                      also takes public donations.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: they post periodic RFPs{' '}
                      <A href="https://www.longview.org/grantmaking/#funding-opportunities">here</A>
                      , though none are open right now; otherwise opportunities are sourced via
                      proactive research
                    </li>
                    <li>
                      Donate: <A href="https://www.longview.org/contact/">contact form</A>;
                      they&apos;re interested in donors giving at least $1m/year for advisory
                      services, and their private funds are open to donors giving over $100k
                    </li>
                    <li>
                      Apply for a job: their{' '}
                      <A href="https://www.longview.org/careers/">careers page</A> lists no open
                      roles and takes general applications only. Their COO / Director of Operations
                      search closed on September 6, 2026, and the posting has since been taken down
                      — its URL now redirects to the careers page.
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="OpenAI Foundation">
              <ul>
                <li>
                  <A href="https://openaifoundation.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      A nonprofit that owns a large stake in OpenAI, spun off in 2025. Their AI
                      resilience team is run by OpenAI cofounder Wojciech Zaremba.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      They now describe three priority programs: life sciences and curing diseases,
                      AI resilience, and civil society and philanthropy. They treat the economic
                      impacts of AI as &ldquo;part of the broader AI resilience agenda&rdquo; but
                      say that, &ldquo;given the scale of the economic transition,&rdquo; they are
                      developing that work as a separate program. Within AI resilience, they&apos;re
                      focused on bio-resilience, cyber-resilience, AI model safety, and AI&apos;s
                      impact on young people.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      donations:{' '}
                      <A href="https://openaifoundation.org/news/resilience-in-the-age-of-ai">
                        $130m+ in AI resilience grants
                      </A>{' '}
                      that they said in June 2026 they were working to finalize
                    </li>
                    <li>
                      staff: 3 publicly named in AI resilience — Wojciech Zaremba, Divya Siddarth,
                      and Dan Wattendorf, whom Zaremba{' '}
                      <A href="https://x.com/woj_zaremba/status/2083256852255736256">announced</A>{' '}
                      in 2026 as Head of Bio-Resilience; they said in August 2026 that the team is
                      &ldquo;still small&rdquo;
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      The Foundation still hasn&apos;t published a list of the AI resilience grants
                      it described as being finalized in June. The ones that have surfaced were
                      announced by the grantees. The Child Mind Institute said on{' '}
                      <A href="https://childmind.org/blog/child-mind-institute-launches-research-initiative-to-inform-safer-ai-systems-for-youth/">
                        July 22, 2026
                      </A>{' '}
                      that it had launched a research initiative on youth mental health and AI
                      chatbots &ldquo;with support from the OpenAI Foundation,&rdquo; without naming
                      an amount; SecureBio Detection said in{' '}
                      <A href="https://securebio.substack.com/p/building-a-three-day-early-warning">
                        August 2026
                      </A>{' '}
                      that it had received $17.2m to cut its pathogen detection time from fourteen
                      days to three. Inside Philanthropy reported in September 2026 that the
                      Foundation has no single publication schedule for its grants.
                    </li>
                    <li>
                      On September 9, 2026 they appointed{' '}
                      <A href="https://openaifoundation.org/news/paul-christiano-joins-openai-foundation-board">
                        Paul Christiano
                      </A>{' '}
                      — founder of the Alignment Research Center, who led alignment research at
                      OpenAI from 2017 to 2021 and is now a Senior Tech Advisor at NIST&apos;s CAISI
                      — to the Foundation Board, as a non-voting observer on the OpenAI Group PBC
                      Board, and to the Foundation Board&apos;s Safety and Security Committee
                      chaired by Zico Kolter. He recuses himself from all OpenAI-related matters and
                      model evaluations.
                    </li>
                    <li>
                      Their other 2026 announcements have been in other programs — $250m for
                      economic futures in May, $50m for the 2026 People-First AI Fund in June, $100m
                      to the Common Health Coalition on August 13 (the first partnership under a new{' '}
                      <A href="https://openaifoundation.org/news/civil-society-and-philanthropy">
                        civil society and philanthropy
                      </A>{' '}
                      program), $60m over three years for{' '}
                      <A href="https://openaifoundation.org/news/ai-forecasting-for-smallholder-farmers">
                        AI weather forecasting for smallholder farmers
                      </A>{' '}
                      on September 10, more than $125m in initial grants for{' '}
                      <A href="https://openaifoundation.org/news/public-data-for-health">
                        Public Data for Health
                      </A>{' '}
                      on September 15, and a voice and low-resource-language commitment with the
                      Gates Foundation on September 21 with no figure attached.
                    </li>
                    <li>
                      In{' '}
                      <A href="https://openaifoundation.org/news/come-build-the-openai-foundation">
                        August 2026
                      </A>{' '}
                      they said they are hiring for more than 20 roles and aim to invest at least
                      $1b over the next year.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for a job: they&apos;re hiring for 14 roles, all in San Francisco,
                      listed <A href="https://openaifoundation.org/careers#open-roles">here</A>. The
                      most AI-safety-relevant are the two AI Resilience roles, a Program Officer for
                      AI Model Safety and a Program Officer for AI Resources; the Program Director
                      for Formal Methods and Chief of Staff for AI Resilience postings listed in
                      September 2026 have since been delisted.
                    </li>
                    <li>
                      Apply for funding: the Foundation itself has no application route, and has not
                      published one. Note that a separate{' '}
                      <A href="https://openai.smapply.org/prog/openais_ai_and_teen_development_research_grant_program/">
                        AI and Teen Development Research Grant Program
                      </A>{' '}
                      — individual grants up to $1m, up to $5m in total, open until October 6, 2026
                      — is topically adjacent to the Foundation&apos;s work on AI and young people
                      but is &ldquo;funded and administered by OpenAI Group PBC,&rdquo; not the
                      Foundation.
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Macroscopic">
              <ul>
                <li>
                  <A href="https://macroscopic.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Swiss nonprofit founded by Ruairí Donnelly, Jonas Vollmer, David Althaus, and
                      Daniel Kestenholz in 2019. Formerly Center for Emerging Risk Research and
                      Polaris Ventures.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      Within AI safety, they&apos;re focused on preventing AI misuse, AI welfare,
                      and cooperation between advanced AI systems. They also donate to reason &amp;
                      democracy and animal welfare and do for-profit investing in their areas of
                      interest.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>donating: up to $100m this year</li>
                    <li>grant sizes: $100k to $15m</li>
                    <li>
                      staff: 14 listed on their{' '}
                      <A href="https://macroscopic.org/about">about page</A>. AI governance is the
                      largest named program; one grants associate works on animal welfare and three
                      roles are pure operations.
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      On September 23, 2026 they and Astralis Foundation launched a joint{' '}
                      <A href="https://middlepowers.ai/">Middle Powers and Transformative AI RFP</A>
                      , run by Astralis in collaboration with Macroscopic. It will allocate around
                      $10m, mostly in grants of $100k to $2m over 6 to 24 months, for work that
                      helps middle powers gain and use leverage over frontier AI development so that
                      it is safer and more broadly beneficial. They say they have in mind
                      &ldquo;countries like the UK, France, Germany, the Netherlands, Switzerland,
                      Canada, Australia, Japan, South Korea and Singapore, and blocs like the
                      EU,&rdquo; with no fixed list. The RFP groups 16 fundable project categories
                      under five headings: recognizing the stakes, building leverage, using leverage
                      to make AI safer, helping the great powers coordinate, and growing the field.
                      Explicitly out of scope: the great powers&apos; own domestic AI policy, bio or
                      cyber resilience work, work that doesn&apos;t engage seriously with
                      transformative AI, AI safety work without a middle-power angle, career
                      transition funding, student groups, electoral or partisan political activity,
                      and commercial work without a safety rationale. Deadline October 23, 2026,
                      reviewed on a rolling basis, with a substantive response aimed at within 4
                      weeks and a final decision within 8 weeks of applying.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: the{' '}
                      <A href="https://middlepowers.ai/">Middle Powers RFP</A> is open to
                      individuals, informal teams, universities, fiscally-sponsored organizations
                      and nonprofits, including nonprofit projects inside for-profits (other
                      for-profits case by case), until October 23, 2026 &mdash;{' '}
                      <A href="https://web.miniextensions.com/4szKcfLG3idx3isNzGbr">apply here</A>.
                      Otherwise you can email{' '}
                      <A href="mailto:info@macroscopic.org">info@macroscopic.org</A>, though most
                      grants are sourced through proactive research and they don&apos;t respond to
                      most proposals
                    </li>
                    <li>
                      Donate: they&apos;re not seeking donations, but they&apos;re happy to advise
                      those donating &gt; $100k
                    </li>
                    <li>
                      Apply for a job: no current open roles, but you can express interest{' '}
                      <A href="https://jobs.ashbyhq.com/macroscopic/0d80e3a8-2ffd-4bef-8485-03f764732a6e">
                        here
                      </A>
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Survival and Flourishing Fund (SFF)">
              <ul>
                <li>
                  <A href="https://survivalandflourishing.fund/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Founded in 2019 and funded by Jaan Tallinn, who was joined by Dustin Moskovitz
                      as a second Funder in the 2026 Main Round &mdash; the first SFF round run for
                      more than one Funder.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      SFF is a virtual fund focused on organizing grant processes to support the
                      long-term survival and flourishing of sentient life. Most grants go to
                      reducing AI x-risk. Jaan Tallinn&apos;s priorities include efforts to restrict
                      AI—datacenter certifications, speed limits, liability laws, labeling
                      requirements, veto committees, and off-switches—as well as constructive
                      efforts to set examples for the positive use of AI—AI assistance for human
                      intelligence, AI healthcare tech, positive moralities, safety specs for AI,
                      and hardware-level AI controls.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      their homepage chart puts annual totals at $33m (2023), $41m (2024) and $35m
                      (2025), rising to $65m in 2026, and says SFF &ldquo;has organized ~$217MM in
                      philanthropic gifts and grants&rdquo; to date; in 2025 they recommended
                      $34.33m across 88 grants, and the 2026 Main Round recommended $64.58m across
                      118 grants
                    </li>
                    <li>
                      staff: 10 people listed at Survival and Flourishing Corp, plus a 2-person
                      board (Andrew Critch and Eric Rogstad). Recommendations are done by part-time
                      recommenders &mdash; twelve of them across three tracks in 2026, two
                      anonymous.
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      The 2026 Main Round, split into Main, Freedom, and Fairness tracks, closed on
                      April 22, and its{' '}
                      <A href="https://survivalandflourishing.fund/2026/recommendations">
                        recommendations
                      </A>{' '}
                      have now been published: $64.58m recommended across 118 grants to 117
                      organizations, with $65.08m expected to be distributed in association with the
                      round &mdash; roughly double their own $14-28m estimate. Jaan Tallinn funds
                      $34.49m of it and Dustin Moskovitz $30.09m. The track totals inverted their
                      expectations: the Freedom Track came in at $31.48m against a $2-4m estimate,
                      making it the largest track, with the Main Track at $14.02m and the Fairness
                      Track at $8.11m. In a September 9, 2026{' '}
                      <A href="https://survivalandflourishing.com/2026-update">update</A>, SFC CEO
                      Ethan Ashkie said the round&apos;s process &ldquo;created confusion and
                      uncertainty, backlash from some Evaluators, delays in grant decisions, and
                      ultimately meant that some applications which SFF Evaluators recommended
                      funding for were not facilitated by SFC.&rdquo; SFC says it does not want to
                      fund people who advocate violence or work that would foreseeably inflame and
                      coarsen public AI discourse.
                    </li>
                    <li>
                      They added three themed rounds for 2026 with $2-4m each — climate change
                      (closed June 10), animal welfare (closed June 24), and human self-enhancement
                      and empowerment (closed July 8). Recommendations for these are expected in
                      November 2026 and have not yet been published.
                    </li>
                    <li>
                      Their programs list now includes an Advisory Organizations Panel, &ldquo;a set
                      of trusted outside organizations that SFC consults for non-binding input on
                      proposed grants where the balance of potential positive and negative impacts
                      is in live debate&rdquo; &mdash; apparently a response to the 2026 process
                      problems described above.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding:{' '}
                      <A href="https://survivalandflourishing.fund/speculation-grants">
                        instructions
                      </A>{' '}
                      for applying to a Speculation Grant
                      <ul>
                        <li>
                          Speculation Grants are faster grants made outside the S-Process timeline.
                          Around 40 people serve as Speculators, each holding a budget of roughly
                          $400-500k to approve them from.
                        </li>
                        <li>
                          Submitting an application also puts you in consideration for the next
                          S-Process Grant round. In fact, being awarded a Speculation Grant is how
                          you guarantee eligibility for a round, and SFF{' '}
                          <A href="https://survivalandflourishing.fund/2026/application">says</A>{' '}
                          over 95% of applications evaluated in past rounds received one.
                        </li>
                      </ul>
                    </li>
                    <li>
                      Donate: No page states a policy on cofunders either way, but they did add a
                      second Funder in 2026; consider reaching out to{' '}
                      <A href="mailto:sff-contact@googlegroups.com">sff-contact@googlegroups.com</A>
                      .
                    </li>
                    <li>
                      Apply for a job: Survival and Flourishing Corp is hiring five roles — four{' '}
                      <A href="https://survivalandflourishing.com/careers/engineering-roles">
                        engineering roles
                      </A>{' '}
                      (full-stack, security, design, and QA/testing) at $250k-$350k, plus a{' '}
                      <A href="https://survivalandflourishing.com/careers/product-manager">
                        Product Manager
                      </A>{' '}
                      at $100k-$150k. All are remote, with 2-4 in-person team weeks a year in the
                      Bay Area.
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Lightcone Commons">
              <ul>
                <li>
                  <A href="https://www.lightconecommons.com/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Announced by Oliver Habryka in July 2026. Their{' '}
                      <A href="https://www.lightconecommons.com/">
                        tentative first-round funder list
                      </A>{' '}
                      is Jaan Tallinn ($10m, conditional on $10m coming from other funders), Dustin
                      Moskovitz (~$5m for the first round, $10m over the first year if it goes
                      well), two anonymous donors ($3m+ and $2m+), the LTFF and the AI Risk
                      Mitigation Fund (~$2m each), Timothy Telleen-Lawton (~$200k), and Andreas
                      Stuhlmüller (~$100k).
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      Lightcone Commons is aiming for near-feature-parity with the S-process used by
                      SFF, with several parts redesigned to make the application and evaluation
                      processes less time-intensive, and a round every three months.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>expecting funders to disburse around $15-25m in the first round</li>
                    <li>
                      fees: 5% on top of grants — 3% to Lightcone Commons and 2% to evaluators,
                      lowered for funders moving large amounts
                    </li>
                    <li>
                      staff: recommendations done by part-time evaluators, currently Zvi Mowshowitz,
                      Yafah Edelman, Eliezer Yudkowsky, Nate Soares, Caleb Parikh, Elizabeth Van
                      Nostrand, and Oliver Habryka, with Katja Grace confirmed for future rounds
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      Applications for the first round closed on August 23, 2026, and
                      recommendations are expected around October 23, 2026; as of October 1, 2026
                      none had been published, and the site still describes the round in the future
                      tense. Applications are still open on a rolling basis: anything submitted now
                      rolls into the second round, with a response expected around January 23, 2027.
                      No deadline for that round has been published yet. Oliver Habryka said in
                      September 2026 that he hopes to move to monthly rounds, probably in Q1 2027,
                      cutting average decision time to 2-3 weeks.
                    </li>
                    <li>
                      The{' '}
                      <A href="https://www.lesswrong.com/posts/FBqe5dt8ZjaHN4Xj9/announcing-the-corrigibility-research-fund">
                        Corrigibility Research Fund
                      </A>
                      , a Lightcone Infrastructure program managed by Max Harms that will award at
                      least $200k in grants and prizes for corrigibility research in 2026, is moving
                      onto Lightcone Commons for its second round, with applications due October 31,
                      2026. Its first round was run over email and awarded $132k to eight of more
                      than 100 applicants, and about $40k of retroactive prizes were paid out on
                      September 30, 2026. Note that this is the CRF&apos;s own deadline, not a
                      Lightcone Commons round deadline.
                    </li>
                    <li>
                      In August 2026 the Long-Term Future Fund announced it was closing, and that it
                      would spend down around $2.8m on existing applicants and longtermist projects,
                      primarily through this first round. Lightcone&apos;s own funder list puts the
                      LTFF contribution at around $2m; the LTFF&apos;s closure post says Lightcone
                      agreed to waive its 3% platform and 2% evaluator fees on it.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: <A href="https://www.lightconecommons.com/apply">here</A>
                      <ul>
                        <li>
                          They also import applications from grantmaking.ai, Manifund, and LTFF.
                        </li>
                      </ul>
                    </li>
                    <li>
                      Donate: They have no strict requirement, but ask that you assign some
                      substantial probability to distributing at least $50k in the coming round;
                      book an onboarding call{' '}
                      <A href="https://calendly.com/oliver-habryka/lightcone-commons-funder-call">
                        here
                      </A>
                      .
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Schmidt Sciences">
              <ul>
                <li>
                  <A href="https://www.schmidtsciences.org/focus-area-ai/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>Science-focused foundation funded by Eric and Wendy Schmidt.</li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      They fund several different areas of science, focused on academic research.
                      Their broader AI portfolio is more focused on beneficial AI in a broad sense
                      and on accelerating AI capabilities, but they also fund research on AI safety.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      donations:{' '}
                      <A href="https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/">
                        $10m to AI safety in 2025
                      </A>
                    </li>
                    <li>
                      staff: 11 listed under &ldquo;AI &amp; Advanced Computing&rdquo; on their team
                      page, mostly not focused on AI safety, estimate 2 in AIS. Michael Belinsky,
                      who led the AI Safety Science program and directed the AI institute, left for
                      the OpenAI Foundation in July 2026; Mark Greaves oversees the AI group while
                      they search for a new leader.
                    </li>
                    <li>
                      their AI safety work now runs under the &ldquo;Science of Trustworthy
                      AI&rdquo; name; the old AI Safety Science page redirects there
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      All three of their 2026 AI safety RFPs have now closed: the science of
                      trustworthy AI (May 17), interpretability (May 26), and multi-agent safety
                      (August 9). Decisions on the first two were due in summer 2026 and the third
                      in autumn 2026; as of October 1, 2026 no 2026 awardees have been announced for
                      any of them, so two of the three decision windows have now slipped.
                    </li>
                    <li>
                      In September 2026 they launched{' '}
                      <A href="https://www.schmidtsciences.org/glossogen/">GlossoGen</A>, an
                      open-source platform for studying the languages AI agents evolve to
                      communicate with each other, framed around keeping agent communication
                      monitorable. No new funding was attached.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding:
                      <ul>
                        <li>
                          Their{' '}
                          <A href="https://schmidtsciences.smapply.io/prog/scaling_ai_safety_for_a_multi_agent_world/">
                            joint RFP on multi-agent safety
                          </A>{' '}
                          with Google DeepMind, ARIA, the Cooperative AI Foundation, and Google.org
                          closed on August 9, 2026 per Schmidt&apos;s own portal, though{' '}
                          <A href="https://deepmind.google/blog/investing-in-multi-agent-ai-safety-research/">
                            Google DeepMind
                          </A>{' '}
                          and the Cooperative AI Foundation both gave the deadline as August 8. The
                          DeepMind announcement is the source for the headline figure of up to $10m
                          across all the funders; awards are tiered at up to $300k (tier 1) and
                          $300k-$1m (tier 2) over 1-2 years.
                        </li>
                        <li>
                          They have no AI safety RFP open right now, and otherwise don&apos;t accept
                          unsolicited proposals. Their{' '}
                          <A href="https://www.schmidtsciences.org/ai-interpretability/">
                            interpretability page
                          </A>{' '}
                          no longer points to a future funding round; it now describes a red-team
                          versus blue-team interpretability competition they are running with NDIF
                          and David Bau at Northeastern University, with no application route.
                        </li>
                      </ul>
                    </li>
                    <li>
                      Apply for a job: They are hiring for scientists, program staff, and fellows in
                      AI <A href="https://jobs.lever.co/schmidt-entities">here</A>.
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="AI Safety Tactical Opportunities Fund (AISTOF)">
              <ul>
                <li>
                  Background:
                  <ul>
                    <li>Founded by JueYan Zhang (former BlackRock PM) in 2023</li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>A multi-donor fund focused on moving fast to fill time-sensitive gaps.</li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>funds raised: &gt; $30m, per their own description</li>
                    <li>grants made: &gt; 150 since September 2023</li>
                    <li>
                      their <A href="https://manifund.org/JueYan">Manifund account</A>, which is
                      only one of their channels, shows $1.75m across 17 grants in 2025 and $2.75m
                      across 27 grants in 2026 through October 1; their most recent grant there was
                      on September 1, 2026
                    </li>
                    <li>
                      Manifund&apos;s <A href="https://trace.manifund.org/orgs/aistof">Trace</A>{' '}
                      database estimates their overall giving at $15.0m in 2025 and $25.0m in 2026,
                      most of it as a lump estimate rather than itemised grants ($47m all-time
                      across 48 records, of which it itemises 9%)
                    </li>
                    <li>staff: ~1 FTE</li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: there&apos;s no open application, but consider posting a
                      proposal on <A href="https://manifund.org/">Manifund</A>
                    </li>
                    <li>
                      Donate: there&apos;s no formal way to do so, but you could reach out to JueYan
                      on <A href="https://www.linkedin.com/in/jueyan/">LinkedIn</A>
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Manifund">
              <ul>
                <li>
                  <A href="https://manifund.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>Founded in 2023 by Austin Chen (formerly Manifold Markets).</li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      Manifund is an open platform where everything is public, grants can be turned
                      around in days, and regrantors make independent calls.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      in 2026 so far (through September 30):
                      <ul>
                        <li>$6.58m donated</li>
                        <li>~153 projects funded</li>
                      </ul>
                    </li>
                    <li>
                      grant sizes between $0-$525k; the largest single donation in 2025-26 was about
                      $440k
                    </li>
                    <li>
                      staff: ~2 FTE. Caroline Ellison joined full-time in August 2026 as Senior
                      Researcher &amp; Ops, and they are advertising three more roles.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: make a public project proposal at{' '}
                      <A href="https://manifund.org/">manifund.org</A>. They also launched the{' '}
                      <A href="https://manifund.substack.com/p/fast-grants-for-ai-x-animals">
                        Falcon Fund
                      </A>{' '}
                      on September 29, 2026 — $500k, grants primarily $25k-$150k, rolling with no
                      deadline, decisions on a one-week timescale — but it funds the intersection of
                      animal welfare and transformative AI rather than AI safety as such, so it is
                      not counted as an open RFP in the table above.
                    </li>
                    <li>
                      Donate: you can donate to projects yourself, or donate to regrantors{' '}
                      <A href="https://manifund.org/about/regranting">here</A>
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="BlueDot Impact">
              <ul>
                <li>
                  <A href="https://bluedot.org/">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      Founded in 2022 as an AI safety training organization. They started making
                      grants at scale in 2026.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      They give fast grants to people and projects working in AI safety and
                      biosecurity, aimed at new projects and individuals.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      donated: $7.41m across 982 grants when checked on October 1, 2026, almost all
                      of it in 2026
                    </li>
                    <li>
                      staff: 17 listed, two of them &ldquo;Talent Investors&rdquo; but none with a
                      grants title; their own figures disagree — their CEO said 15 in a September
                      12, 2026 post and their join-us page says &ldquo;a team of 16, growing to
                      20&rdquo; — and the CEO said they could grow 3-5x over the next year
                    </li>
                    <li>
                      funders: Coefficient Giving made them a $25.6m three-year general support
                      grant in 2025; their CEO said in September 2026 that they have raised $71m in
                      total
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      In September 2026 Coefficient Giving{' '}
                      <A href="https://coefficientgiving.org/funds/global-catastrophic-risks-opportunities/career-development-and-transition-funding/">
                        handed over its career development and transition funding program
                      </A>{' '}
                      to BlueDot, with a grant to support it; Coefficient now directs those
                      applicants to BlueDot&apos;s two grant programs.
                    </li>
                    <li>
                      In a September 12, 2026 <A href="https://blog.bluedot.org/p/owners">post</A>,
                      their CEO said they have raised $71m, are 15 people and could grow 3-5x in a
                      year, make grants ranging from $100 to $200,000, and are building a downtown
                      San Francisco campus for more than 200 people.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: they have two grant programs:
                      <ul>
                        <li>
                          <A href="https://bluedot.org/grants/career-transition">
                            Career Transition Grants
                          </A>{' '}
                          of up to $200k, generally starting at $20k, for people switching to work
                          full-time on AI safety or biosecurity — application: 45 minutes, decision
                          time: 20 days
                        </li>
                        <li>
                          <A href="https://bluedot.org/grants/rapid">Rapid Grants</A>: up to $20k
                          for AI safety or biosecurity work, now explicitly including events,
                          community and travel as well as projects — application: about 15 minutes,
                          decision time: 4 days on average, with 9 in 10 applicants hearing back
                          within 14 days
                        </li>
                        <li>
                          They also run{' '}
                          <A href="https://bluedot.org/programs/incubator-week">Incubator Week</A>,
                          a 5-day expenses-paid program in San Francisco offering up to $100k in
                          funding if they back your pitch — a much higher ceiling than either grant
                          program. The next cohort runs November 2-6, 2026, with applications due
                          October 28.
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>

            <Funder title="Transformative AI Fund (TAIF), formerly the Long-Term Future Fund (LTFF)">
              <ul>
                <li>
                  <A href="https://funds.effectivealtruism.org/funds/transformative-ai">Website</A>
                </li>
                <li>
                  Background:
                  <ul>
                    <li>
                      The LTFF started in 2017 as a project of Centre for Effective Altruism. In
                      August 2026 EA Funds{' '}
                      <A href="https://forum.effectivealtruism.org/posts/dtZ9wbKWjtvGWDRJx/closing-the-ltff-spending-down-funds-and-a-new-ai-fund-at-ea">
                        closed the LTFF
                      </A>{' '}
                      and{' '}
                      <A href="https://forum.effectivealtruism.org/posts/dYuNi5Rh68o9YKstg/ea-funds-is-launching-the-transformative-ai-fund">
                        launched the Transformative AI Fund
                      </A>{' '}
                      in its place, with Lowe Lundin as full-time Head of Fund. The LTFF&apos;s
                      outgoing managers said the closure was partly about institutional friction
                      around grants to individuals, for-profits, and policy-adjacent work; several
                      of them plan to keep granting part-time through the AI Risk Mitigation Fund
                      and Lightcone Commons.
                    </li>
                  </ul>
                </li>
                <li>
                  Thesis:
                  <ul>
                    <li>
                      Early-stage grants to individuals, new organizations, and existing
                      organizations with new projects. Primary focus is technical AI safety and AI
                      governance, including post-AGI governance, plus field-building and
                      forecasting.
                    </li>
                  </ul>
                </li>
                <li>
                  By the numbers:
                  <ul>
                    <li>
                      the LTFF donated around $5-6m/year through 2024, but only $1.2m in 2025 and
                      $0.3m in 2026 as recorded in the public grants database; EA Funds&apos; own
                      payout chart shows more for 2026, $1.52m across 18 grants
                    </li>
                    <li>
                      number of grants: 100-200/year through 2024, but 20 in 2025 and 6 in 2026 in
                      the public database, which runs through 2026 Q2
                    </li>
                    <li>
                      grant size: typically $10k-$150k, rarely above $300k — now TAIF&apos;s stated
                      policy, not just LTFF&apos;s historical pattern
                    </li>
                    <li>
                      staff: 1 full-time (Lowe Lundin); advisors Caleb Parikh and Catherine Low are
                      part-time
                    </li>
                    <li>stated response time: 6-8 weeks</li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      No narrative payout report has been posted since the one covering May 2023 to
                      March 2024, though the{' '}
                      <A href="https://funds.effectivealtruism.org/grants">grants database</A> is
                      updated through 2026 Q2. TAIF says it will publish its first quarterly report
                      before the end of 2026. As of October 1, 2026 no TAIF grants appear in that
                      database and the fund page lists no payout reports, so nearly two months after
                      launch none of its grantmaking is public yet.
                    </li>
                    <li>
                      The LTFF is spending down around $3.7m: roughly $2.8m to existing applicants,
                      mostly through the first{' '}
                      <A href="https://www.lightconecommons.com/">Lightcone Commons</A> round, and
                      around $0.9m as a seed grant to TAIF.
                    </li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: use{' '}
                      <A href="https://av20jp3z.paperform.co/?fund=Transformative%20AI%20Fund">
                        this form
                      </A>
                      ; applications are rolling. The LTFF is no longer taking new applications, and
                      live LTFF applications were imported into the first Lightcone Commons round.
                    </li>
                    <li>
                      Donate: donate to TAIF{' '}
                      <A href="https://www.givingwhatwecan.org/charities/transformative-ai-fund">
                        here
                      </A>
                      ; TAIF is actively fundraising beyond its ~$1m seed grant
                    </li>
                    <li>
                      Apply for a job: the Associate Program Officer search has closed. CEA&apos;s{' '}
                      <A href="https://jobs.ashbyhq.com/centreforeffectivealtruism">job board</A>{' '}
                      has no TAIF-specific role open; its only grantmaking opening is Head of the EA
                      Infrastructure Fund, the Head of Grantmaking Operations posting having since
                      been delisted.
                    </li>
                  </ul>
                </li>
              </ul>
            </Funder>
          </div>
        </div>

        <CollapsibleSection title="Not included">
          <ul className="space-y-3 text-sm text-gray-600 [&_a]:text-orange-600">
            <li>
              <A href="https://astralisfoundation.org/">Astralis Foundation</A>: They now have a
              fair bit of public info — named focus areas, named grantees, and{' '}
              <A href="https://astralisfoundation.org/our-people">a team page</A> listing 11 staff
              plus 6 board members across their UK and Swedish entities — but they&apos;re still not
              taking unsolicited funding requests, and they publish no giving totals. Their homepage
              now says they &ldquo;pool money from well over a dozen donors across several
              countries,&rdquo; and their main vehicle is a pooled fund called Shared Horizons. The
              strongest case in this section for promotion to the main list next refresh. Based on{' '}
              <A href="https://web.archive.org/web/20260121035945/https://effectivealtruism.nz/job-board/ai-governance-fund-lead-astralis-foundation">
                this job posting
              </A>{' '}
              from late 2025 (now removed from the live job board), they have a fund focused on
              international AI governance, the Shared Horizons fund, aiming to deploy $15m in 2026;
              the same posting says Astralis has raised over $20m for AI safety from 15 donors and
              deployed it to 14 organizations. On September 23, 2026 they launched the{' '}
              <A href="https://middlepowers.ai/">Middle Powers and Transformative AI RFP</A>, run by
              Astralis in collaboration with Macroscopic, allocating around $10m in grants of $100k
              to $2m with a deadline of October 23, 2026 (details under Macroscopic above).
            </li>
            <li>
              <A href="https://www.mercor.com/careers/1d59ce50-4207-4d95-b7fd-5a01e90b0897/">
                Mercor AI Safety Fund
              </A>
              : Announced September 15, 2026. &ldquo;Mercor is committing $5 million to fund safety
              research. Award size and mix depend on the project,&rdquo; covering researcher hours,
              API costs, conference stipends, and the time of experts from Mercor&apos;s platform.
              Named interest areas are misalignment, sandbox escape, evaluation awareness,
              interpretability, oversight and control, and red-teaming methodology. Applications are
              rolling with no deadline, but eligibility is narrow: applicants must be based in the
              US or UK, and awards go to the researcher&apos;s institution — universities, nonprofit
              research organizations, public benefit corporations, and small startups &ldquo;that do
              not sell AI training data.&rdquo; Mercor is a for-profit company, and the award terms
              carry commercial strings: grantees keep ownership but grant Mercor a non-exclusive
              licence to use the work commercially; for benchmark and evaluation projects Mercor
              gets early access plus &ldquo;the exclusive right to build and host a private held-out
              test set&rdquo;; and grantees agree not to work with specified Mercor competitors on
              substantially similar benchmarks during the award and for 12 months afterward.
              Grantees are expected to publish under an open licence permitting commercial use. Not
              in the main table because it is a single $5m commitment rather than an annual
              programme, and no giving figures have been published yet — but it is open now and a
              candidate for promotion.
            </li>
            <li>
              <A href="https://www.halcyonfutures.org/">Halcyon Futures</A>: An incubator-grantmaker
              for new AI safety organizations, taking applications on a rolling basis. Their site
              lists career transition grants up to $500k, nonprofit seed grants up to $1m, and VC
              investments &ldquo;up to $1M, and sometimes much more,&rdquo; plus a request for
              founders. They publish no annual totals or grant counts, which is why they are not in
              the main table; they also appear as a cofunder of the UK AI Security Institute&apos;s
              Alignment Project.
            </li>
            <li>
              <A href="https://www.navigation.org/">Navigation Fund</A>: Jed McCaleb&apos;s
              foundation. At one point they{' '}
              <A href="https://forum.effectivealtruism.org/posts/NAcN98bACuwcnB32H/the-navigation-fund-launched-is-hiring-a-program-officer-to">
                announced
              </A>{' '}
              they were giving $20m/year to AI safety, but this seems to have not materialized and
              it&apos;s now gone from their website.
            </li>
            <li>
              <A href="https://www.airiskfund.com/">AI Risk Mitigation Fund</A>: They announced a
              spinoff from LTFF in 2023, but haven&apos;t made any updates or grant announcements on
              their website. They&apos;re one of the funders of Lightcone Commons, contributing
              around $2m to its first round. Their{' '}
              <A href="https://www.airiskfund.com/apply">apply page</A> says they have no set date
              for opening applications and currently fund only opportunities they source themselves.
            </li>
            <li>
              <A href="https://futureoflife.org/">FLI</A>: They were previously more active in open
              application programs and seem to be less focused on those these days, though they are
              still a sizeable grantmaker — their 2025 grants page, published in July 2026, includes
              awards of $1.95m to IASEAI and around $0.5m each to several other organizations. Their{' '}
              <A href="https://futureoflife.org/grant-program/phd-fellowships/">PhD fellowship</A>{' '}
              is now paused — they aren&apos;t accepting applications in fall 2026 while they
              reassess the program. Their one open program is the{' '}
              <A href="https://futureoflife.org/project/digital-media-accelerator/">
                Digital Media Accelerator
              </A>
              , which funds AI safety content creators on a rolling basis and doesn&apos;t publish
              grant sizes. A September 2026 update to that page says they are prioritizing content
              on the AI industry&apos;s &ldquo;race-to-replace,&rdquo; escalating harms from
              advanced systems, and loss-of-control risk, and warns that &ldquo;review timelines for
              applications are longer than normal at the moment.&rdquo; Their grantmaking page
              otherwise lists no open programs and says they do not accept unsolicited requests.
            </li>
            <li>
              <A href="https://www.frontiermodelforum.org/ai-safety-fund/">
                Frontier Model Forum AI Safety Fund
              </A>
              : It was established in October 2023 as a &ldquo;$10 million+&rdquo; initiative. Most
              of this was distributed in 2024 and 2025 — their most recent grantees were announced
              in December 2025, and there have been no 2026 grantees or news — and they now appear
              to be winding down, saying their remaining funds &ldquo;will be used to support
              narrowly-scoped research projects that target urgent bottlenecks.&rdquo; The fund was
              initially administered by the Meridian Institute, and the Forum has managed it
              directly since Meridian announced in June 2025 that it was closing.
            </li>
            <li>
              <A href="https://foresight.org/grants/ai-science-safety-nodes-rfp/">
                Foresight AI for Science &amp; Safety Nodes RFP
              </A>
              : Their standalone AI for Safety and Science program page now redirects here, so the
              Nodes RFP is the whole of their current AI offering, and they publish no annual
              budget. The RFP (deadline October 31, 2026, 23:59 PDT) funds work on local compute,
              coordination and accountability, and AI-first science, &ldquo;typically $30,000 –
              $100,000 for this RFP but larger amounts are possible for the right project&rdquo;,
              with overhead capped at 10% and review about three months after the deadline. All
              funded work must be open-sourced. They strongly prefer applicants who will be
              in-person members of their SF or Berlin hubs; they have also added a community xNode
              in Cape Town. Applicants can opt in to having their application shared with Lightcone
              Commons for additional funding consideration.
            </li>
            <li>
              <A href="https://astera.org/ai-safety/">Astera</A>: Their webpage mentions that
              they&apos;re primarily backing <A href="https://www.simplexaisafety.com/">Simplex</A>.
            </li>
            <li>
              <A href="http://grantmaking.ai">grantmaking.ai</A>: New initiative housed under
              Manifund, with an initial $1m funded by Anton Makiievskyi, see{' '}
              <A href="https://www.lesswrong.com/posts/hDQZZzYkcipgaZfxy/usd1m-ai-x-risk-grant-round-is-live-on-grantmaking-ai-apply">
                launch post
              </A>
              . That round closed in July 2026; per their{' '}
              <A href="https://app.grantmaking.ai/results/launch">results page</A>, all $1m was
              distributed to 33 projects out of 581 applications, averaging $30,303, with 91
              reviewer-endorsed and 143 screened out. They published a{' '}
              <A href="https://grantmaking.substack.com/p/grantmakingai-launch-round-retrospective">
                retrospective
              </A>{' '}
              on August 14, 2026 saying they have &ldquo;many ideas for the future&rdquo; but that
              plans will take time to finalize. No second round has been announced.
            </li>
            <li>
              <A href="https://www.darpa.mil/research/programs/ai-forge">AI Forge</A>: A joint
              DARPA/NSF program launched on June 1, 2026, working with CAISI at NIST, to fund
              research on AI interpretability, AI control, and adversarial robustness. Per the
              program&apos;s RFI (SAM.gov notice DARPA-SN-26-80 — the figures are not on the DARPA
              program page), its &ldquo;Project Ventures&rdquo; are &ldquo;university-led efforts
              ranging from $750K to $3M or higher&rdquo; spanning up to one year, targeted at US
              universities including military service academies, with key personnel expected to be
              US citizens or permanent residents. That RFI closed on June 22, 2026 and drew nearly
              130 responses; no follow-on solicitation or awardees have been announced. The forum
              was slated to launch in summer 2026 and its administering nonprofit still has not been
              publicly named as of October 2026.
            </li>
            <li>
              <A href="https://www.iliad.ac/funding">ILIAD</A>: They fund new research organizations
              that meet a high bar of scientific rigor. As of October 2026 they list both a request
              for proposals (epistemics-raising projects and theory-driven research on ReLU
              networks) and a rolling open call for research projects — but still don&apos;t publish
              grant sizes or deadlines.
            </li>
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Notes">
          <ol className="list-decimal space-y-2 pl-6 text-sm text-gray-500 [&_a]:break-all [&_a]:text-orange-600">
            {NOTES.map((note, i) => (
              <li key={i} id={`note-${i + 1}`} className="scroll-mt-4 target:text-gray-900">
                {note.node}
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-gray-900">Other resources</h2>
        <p className="text-sm text-gray-600 [&_a]:text-orange-600">
          See another database of AIS funding at{' '}
          <A href="https://aisafety.com/funding">https://aisafety.com/funding</A>
          &nbsp;and subscribe to their newsletter at{' '}
          <A href="https://aisafetyfunding.substack.com/">https://aisafetyfunding.substack.com/</A>.
          Manifund also launched <A href="https://trace.manifund.org">Trace</A> in August 2026, a
          database tracking $3.49b of AI safety funding across 4,837 grants, 802 funders and 1,984
          recipients as of October 1, 2026, with dated grants going back to 2007. It is available as
          a website, an API, an MCP endpoint, and a bulk download. Note that the figures above come
          from its API and CSV export; the stat tiles rendered on its homepage currently show a
          smaller set, and we have not established why the two differ.
        </p>
      </div>
    </div>
  )
}
