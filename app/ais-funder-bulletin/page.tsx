import 'server-only'
import Link from 'next/link'
import React from 'react'

export const metadata = {
  title: 'AI Safety Funder Bulletin',
  description: 'A digest of funders in the AI safety space.',
}

const LAST_UPDATED = 'September 11, 2026'

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
    donated2025: { v: '$415M', n: 1 },
    grants2025: { v: '231', n: 2 },
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
    fte: '15',
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
    fte: '2',
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
    openRfps: false,
    donations: false,
  },
  {
    name: 'SFF',
    href: 'https://survivalandflourishing.fund/',
    donated2025: { v: '$35M', n: 9 },
    grants2025: { v: '88', n: 10 },
    expected2026: { v: '$30M', n: 11 },
    fte: '9',
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
    donated2025: { v: '—' },
    grants2025: { v: '—' },
    expected2026: { v: '$40M', n: 16 },
    fte: '1',
    generalApps: false,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Manifund',
    href: 'https://manifund.org/',
    donated2025: { v: '$6M', n: 17 },
    grants2025: { v: '144', n: 18 },
    expected2026: { v: '$8.6M', n: 19 },
    fte: '1',
    generalApps: true,
    openRfps: false,
    donations: true,
  },
  {
    name: 'BlueDot Impact',
    href: 'https://bluedot.org/',
    donated2025: { v: '$0', n: 20 },
    grants2025: { v: '0', n: 20 },
    expected2026: { v: '$7.6M', n: 21 },
    fte: '1',
    generalApps: true,
    openRfps: false,
    donations: false,
  },
  {
    name: 'Transformative AI Fund (formerly LTFF)',
    href: 'https://funds.effectivealtruism.org/funds/transformative-ai',
    donated2025: { v: '$1.2M', n: 22 },
    grants2025: { v: '20', n: 22 },
    expected2026: { v: '$4M', n: 23 },
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
    text: "Using public grants on https://coefficientgiving.org/funds for the Navigating Transformative AI Fund ($318.0M in 2025) and the GCR Opportunities Fund ($97.0M), totalling $415.0M as of September 1, 2026. I don't know what the total of nonpublic AIS grants was; their 2025 letter from the CEO says they directed over $1B across all cause areas in 2025.",
    node: (
      <>
        Using public grants on{' '}
        <A href="https://coefficientgiving.org/funds">https://coefficientgiving.org/funds</A>
        &nbsp;for the Navigating Transformative AI Fund ($318.0M in 2025) and the GCR Opportunities
        Fund ($97.0M), totalling $415.0M as of September 1, 2026. I don&apos;t know what the total
        of nonpublic AIS grants was; their{' '}
        <A href="https://coefficientgiving.org/research/2025-letter-from-the-ceo/">
          2025 letter from the CEO
        </A>{' '}
        says they directed over $1B across all cause areas in 2025.
      </>
    ),
  },
  {
    text: 'Filtering https://coefficientgiving.org/funds by year gives 188 grants in 2025 for the Navigating Transformative AI Fund and 43 for the GCR Opportunities Fund. These counts still grow as back-dated grants are published.',
    node: (
      <>
        Filtering{' '}
        <A href="https://coefficientgiving.org/funds">https://coefficientgiving.org/funds</A> by
        year gives 188 grants in 2025 for the Navigating Transformative AI Fund and 43 for the GCR
        Opportunities Fund. These counts still grow as back-dated grants are published.
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
    text: 'Per this post from a Longview team member, they directed over $60M in 2025, more than 2x their 2024 figure. Their August 2026 COO job posting says "We directed over $75 million to high-impact organizations in 2025, and expect 2026 will be substantially bigger," but that figure covers all of Longview\'s giving rather than AI safety specifically.',
    node: (
      <>
        Per{' '}
        <A href="https://forum.effectivealtruism.org/posts/aX8xLjCLd4LMDpTYL/longview-is-hiring-what-longview-is-like-from-my-perspective">
          this post from a Longview team member
        </A>
        , they directed over $60M in 2025, more than 2x their 2024 figure. Their August 2026{' '}
        <A href="https://www.longview.org/careers/chief-operating-officer/">COO job posting</A> says
        &ldquo;We directed over $75 million to high-impact organizations in 2025, and expect 2026
        will be substantially bigger,&rdquo; but that figure covers all of Longview&apos;s giving
        rather than AI safety specifically.
      </>
    ),
  },
  {
    text: 'Longview\'s hiring materials said "In 2026, we aim to move $200 million — making us the second largest funder in that field." That page has since been taken down; an archived copy survives. As of September 2026 no live Longview page states a 2026 target — their COO posting says only that they expect 2026 to be "substantially bigger" than 2025.',
    node: (
      <>
        Longview&apos;s{' '}
        <A href="https://web.archive.org/web/20260520132637/https://www.longview.org/careers/people-operations-associate/">
          hiring materials
        </A>{' '}
        said &ldquo;In 2026, we aim to move $200 million — making us the second largest funder in
        that field.&rdquo; That page has since been taken down; an archived copy survives. As of
        September 2026 no live Longview page states a 2026 target — their{' '}
        <A href="https://www.longview.org/careers/chief-operating-officer/">COO posting</A> says
        only that they expect 2026 to be &ldquo;substantially bigger&rdquo; than 2025.
      </>
    ),
  },
  {
    text: 'Estimate: as of June 2026 they said they were working to finalize more than $130M in grants through their AI resilience program, "to be shared publicly soon and with more to come," and planning to give away at least $1B across all programs over the next year. The Foundation has still not published an AI resilience grantee list; the first grant to surface was announced by the grantee, SecureBio, which said in August 2026 that it had received $17.2M for its pathogen-detection work.',
    node: (
      <>
        Estimate: as of June 2026 they{' '}
        <A href="https://openaifoundation.org/news/resilience-in-the-age-of-ai">said</A> they were
        working to finalize more than $130M in grants through their AI resilience program, &ldquo;to
        be shared publicly soon and with more to come,&rdquo; and planning to give away at least $1B
        across all programs over the next year. The Foundation has still not published an AI
        resilience grantee list; the first grant to surface was{' '}
        <A href="https://securebio.substack.com/p/building-a-three-day-early-warning">
          announced by the grantee
        </A>
        , SecureBio, which said in August 2026 that it had received $17.2M for its
        pathogen-detection work.
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
        <A href="https://macroscopic.org/grants">Macroscopic&apos;s grants page</A> says &ldquo;This
        year, we plan to give up to $100m in total to organizations and individuals in our focus
        areas.&rdquo; Their{' '}
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
    text: "Per SFF's announcement, they are planning to give $20–40M.",
    node: (
      <>
        Per{' '}
        <A href="https://survivalandflourishing.fund/2026/application">SFF&apos;s announcement</A>,
        they are planning to give $20–40M.
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
    text: 'schmidtsciences.org new $10M AI safety science program (foundational research)',
    node: (
      <A href="https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/">
        https://www.schmidtsciences.org/new-10-million-ai-safety-science-program-launched-for-foundational-research/
      </A>
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
    text: 'Private communications',
    node: <>Private communications</>,
  },
  {
    text: 'manifund.org/about',
    node: <A href="https://manifund.org/about">https://manifund.org/about</A>,
  },
  {
    text: 'Distinct projects that received funding in 2025.',
    node: <>Distinct projects that received funding in 2025.</>,
  },
  {
    text: 'Around $5.7M donated between January 1 and August 31, 2026, per the data behind manifund.org/about, extrapolated to a full year.',
    node: (
      <>
        Around $5.7M donated between January 1 and August 31, 2026, per the data behind{' '}
        <A href="https://manifund.org/about">manifund.org/about</A>, extrapolated to a full year.
      </>
    ),
  },
  {
    text: 'Treated as zero: their published list of rapid grants shows only 16 grants totalling about $10.7k made between June and December 2025, negligible at the scale of this table. They began granting at scale in 2026, and Career Transition Grants only launched in May 2026.',
    node: (
      <>
        Treated as zero: their published list of{' '}
        <A href="https://bluedot.org/grants/rapid">rapid grants</A> shows only 16 grants totalling
        about $10.7k made between June and December 2025, negligible at the scale of this table.
        They began granting at scale in 2026, and Career Transition Grants only launched in May
        2026.
      </>
    ),
  },
  {
    text: 'Their grant pages reported 671 rapid grants ($1,545,745) and 59 career transition grants ($3,513,485) as of September 1, 2026 — about $5.0M of it in 2026 — extrapolated to a full year.',
    node: (
      <>
        Their grant pages reported <A href="https://bluedot.org/grants/rapid">671 rapid grants</A>{' '}
        ($1,545,745) and{' '}
        <A href="https://bluedot.org/grants/career-transition">59 career transition grants</A>{' '}
        ($3,513,485) as of September 1, 2026 — about $5.0M of it in 2026 — extrapolated to a full
        year.
      </>
    ),
  },
  {
    text: "LTFF grants recorded for 2025 in the EA Funds grants database. That database is incomplete: it lists 693 LTFF grants totalling $30.2M all-time, while the fund's own successor announcement says LTFF made 820+ grants totalling just under $35M since 2017. The payout chart on EA Funds' own fund pages shows the higher figure — 821 grants totalling $35.3M — so roughly 128 grants and $5.2M are missing from the public database.",
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
        Funds&apos; own fund pages shows the higher figure — 821 grants totalling $35.3M — so
        roughly 128 grants and $5.2M are missing from the public database.
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
                    <li>grant sizes: $10k to $50m</li>
                    <li>
                      number of grants: the Navigating Transformative AI Fund lists 188 in 2025
                      ($318.0m) and 66 so far in 2026 ($137.2m); the GCR Opportunities Fund lists 43
                      ($97.0m) and 11 ($27.0m)
                    </li>
                    <li>
                      note that the public grants database understates their AI giving: their $160m
                      grant to Resolution, announced in July 2026, does not appear in it.
                    </li>
                    <li>
                      staff: ~198 total. 42 of the 107 staff working on grants are on AI-focused
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
                      In September 2026 they launched{' '}
                      <A href="https://coefficientgiving.org/tailwind/">Project Tailwind</A>, a
                      call for founders to launch new AI safety organizations — see Get involved
                      below.
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
                      that were due August 2. As of September 2026 the only role on their careers
                      page is a Business Immigration Associate, posted August 18.
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
                              <A href="https://coefficientgiving.org/funds/global-catastrophic-risks-opportunities/career-development-and-transition-funding/">
                                career transition funding
                              </A>{' '}
                              (e.g. graduate school, internships, or independent study for building
                              career capacity for people working on reducing global catastrophic
                              risk) — decisions within 6 weeks
                            </li>
                            <li>
                              <A href="https://coefficientgiving.org/funds/global-catastrophic-risks-opportunities/funding-for-programs-and-events-on-global-catastrophic-risk-effective-altruism-and-other-topics/">
                                programs and events
                              </A>{' '}
                              on global catastrophic risk, effective altruism, and related topics —
                              decisions within 3 months
                            </li>
                          </ul>
                        </li>
                        <li>
                          <A href="https://coefficientgiving.org/tailwind/">Project Tailwind</A>{' '}
                          (launched September 2026) is a call for founders to start new AI safety
                          organizations targeting catastrophic risks, with a{' '}
                          <A href="https://coefficientgiving.org/tailwind/initiatives/">
                            list of initiatives
                          </A>{' '}
                          they want funded. Funding runs from pre-seed ($200k-$2m) through seed
                          ($2m-$20m) to scale ($20m-$200m+); express interest{' '}
                          <A href="https://coefficientgiving.org/tailwind/get-involved/">here</A>.
                          They automatically filter out submissions unrelated to catastrophic
                          risks from AI, or that appear AI-generated.
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
                      Apply for a job: their only open role as of September 2026 is a{' '}
                      <A href="https://jobs.ashbyhq.com/coefficientgiving/7fe767dd-0c29-4923-9c85-77f92cdde1c2">
                        Business Immigration Associate
                      </A>{' '}
                      (remote, global); otherwise you can express interest{' '}
                      <A href="https://coefficientgiving.org/about-us/careers/">here</A>
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
                      staff: 30 listed, 9 of them with AI program titles; around half the org
                      working on AIS gets 15. They describe themselves as &ldquo;~35 people&rdquo;
                      including accepted offers.
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
                      , their public fund, and are no longer accepting new donations to it;
                      donations received through Giving What We Can by September 30, 2026 go into a
                      final grant round. The fund granted more than $3.5m from over 2,000 donors
                      since launching in 2022. Their Nuclear Weapons Policy Fund now takes public
                      donations instead.
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
                      Apply for a job: they are hiring a{' '}
                      <A href="https://www.longview.org/careers/chief-operating-officer/">
                        COO / Director of Operations
                      </A>{' '}
                      (applications due September 6, 2026); otherwise you can express interest{' '}
                      <A href="https://www.longview.org/careers/">here</A>
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
                      AI resilience, and civil society and philanthropy. Their economic futures work
                      has been folded into AI resilience. Within AI resilience, they&apos;re focused
                      on bio-resilience, cyber-resilience, AI model safety, and AI&apos;s impact on
                      young people.
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
                      staff: 2 publicly named in AI resilience (Wojciech Zaremba and Divya
                      Siddarth); they said in August 2026 that the team is &ldquo;still small&rdquo;
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      The Foundation still hasn&apos;t published a list of the AI resilience grants
                      it described as being finalized in June. The first one to surface was
                      announced by the grantee: SecureBio said in{' '}
                      <A href="https://securebio.substack.com/p/building-a-three-day-early-warning">
                        August 2026
                      </A>{' '}
                      that it had received $17.2m to cut its pathogen detection time from fourteen
                      days to three.
                    </li>
                    <li>
                      Their other 2026 announcements have been in other programs — $250m for
                      economic futures in May, $50m for the 2026 People-First AI Fund in June, and
                      $100m for a new{' '}
                      <A href="https://openaifoundation.org/news/civil-society-and-philanthropy">
                        civil society and philanthropy
                      </A>{' '}
                      program on August 13.
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
                      Apply for a job: they&apos;re hiring for 18 roles, all in San Francisco,
                      listed <A href="https://openaifoundation.org/careers#open-roles">here</A>. The
                      most AI-safety-relevant are a Program Officer for AI Model Safety, a Program
                      Director for Formal Methods, and a Chief of Staff for AI Resilience.
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
                      Swiss nonprofit founded by Ruairi Donnelly, Jonas Vollmer, David Althaus, and
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
                    <li>staff: 13 listed on their team page, most working on AI-related areas.</li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: you can email{' '}
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
                    <li>Founded in 2019 and funded by Jaan Tallinn.</li>
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
                      typically deploy around $30-40m across ~90 grants in recent years; in 2025
                      they recommended $34.33m across 88 grants
                    </li>
                    <li>
                      staff: ~10 people listed at Survival and Flourishing Corp, plus a 2-person
                      board. Recommendations are done by part-time recommenders.
                    </li>
                  </ul>
                </li>
                <li>
                  Recent updates:
                  <ul>
                    <li>
                      The 2026 Main Round, split into Main, Freedom, and Fairness tracks, closed on
                      April 22; recommendations are expected in September 2026.
                    </li>
                    <li>
                      They added three themed rounds for 2026 with $2-4m each — climate change
                      (closed June 10), animal welfare (closed June 24), and human self-enhancement
                      and empowerment (closed July 8). Recommendations for these are expected in
                      November 2026.
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
                      Donate: They don&apos;t appear to be actively soliciting cofunders, but
                      consider reaching out to{' '}
                      <A href="mailto:sff-contact@googlegroups.com">sff-contact@googlegroups.com</A>
                      .
                    </li>
                    <li>
                      Apply for a job: They are currently hiring for a{' '}
                      <A href="https://survivalandflourishing.com/careers/full-stack-engineer">
                        software engineer
                      </A>{' '}
                      role.
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
                      Announced by Oliver Habryka in July 2026. Initial funding is coming from Jaan
                      Tallinn ($10m), Dustin Moskovitz (~$5m), two anonymous donors, the LTFF and
                      the AI Risk Mitigation Fund (~$2m each), and others.
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
                      recommendations are expected around October 23, 2026. Applications are still
                      open on a rolling basis: anything submitted now rolls into the second round,
                      with a response expected around January 23, 2027. No deadline for that round
                      has been published yet.
                    </li>
                    <li>
                      In August 2026 the Long-Term Future Fund announced it was closing, and that it
                      would spend down around $2.8m on existing applicants and longtermist projects,
                      primarily through this first round. Lightcone&apos;s own funder list puts the
                      LTFF contribution at around $2m, and says its 3% platform and 2% evaluator
                      fees are waived on it.
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
                      Donate: They are looking to onboard donors giving at least $50k: book an
                      onboarding call{' '}
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
                    <li>staff: 14 in AI, but mostly not focused on AI safety, estimate 2 in AIS</li>
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
                      (August 9). Decisions on the first two were due in summer 2026 and on the
                      third in autumn 2026, but no 2026 awardees have been announced yet.
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
                          — up to $10m across all the funders — closed on August 9, 2026.
                        </li>
                        <li>
                          They have no AI safety RFP open right now, and otherwise don&apos;t accept
                          unsolicited proposals. Their interpretability page says to check back
                          later in 2026 for more funding opportunities.
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
                    <li>funds raised: &gt; $30m</li>
                    <li>grants made: &gt; 150 since September 2023</li>
                    <li>
                      their <A href="https://manifund.org/JueYan">Manifund account</A>, which is
                      only one of their channels, shows $1.75m across 17 grants in 2025 and $2.26m
                      across 24 grants in 2026 through August
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
                      in 2026 so far (through August 31):
                      <ul>
                        <li>$5.7m donated</li>
                        <li>~140 projects funded</li>
                      </ul>
                    </li>
                    <li>grant sizes between $0-$500k</li>
                    <li>staff: ~1 FTE</li>
                  </ul>
                </li>
                <li>
                  Get involved:
                  <ul>
                    <li>
                      Apply for funding: make a public project proposal at{' '}
                      <A href="https://manifund.org/">manifund.org</A>
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
                    <li>donated: $5.06m across 730 grants, almost all of it in 2026</li>
                    <li>
                      staff: 10 listed, none with a grantmaking title; they say they intend to scale
                      to 20, and are recruiting a Program Lead for Career Transition Grants
                    </li>
                    <li>
                      funders: Coefficient Giving made them a $25.6m three-year general support
                      grant in 2025
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
                          for people switching to work full-time on AI safety or biosecurity —
                          application: 45 minutes, decision time: 20 days
                        </li>
                        <li>
                          <A href="https://bluedot.org/grants/rapid">Rapid Grants</A>: $50 to $10k
                          for concrete AI safety or biosecurity projects — application: 5 minutes,
                          decision time: 3 days
                        </li>
                        <li>
                          They also run{' '}
                          <A href="https://bluedot.org/programs/incubator-week">Incubator Week</A>,
                          a 5-day expenses-paid program in San Francisco offering up to $100k in
                          funding if they back your pitch — a much higher ceiling than either grant
                          program. The most recent cohort ran August 24-28, 2026.
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
                      $0.3m in the first half of 2026
                    </li>
                    <li>
                      number of grants: 100-200/year through 2024, but 20 in 2025 and 6 in the first
                      half of 2026
                    </li>
                    <li>
                      grant size: typically $10k-$150k, rarely above $300k — now TAIF&apos;s stated
                      policy, not just LTFF&apos;s historical pattern
                    </li>
                    <li>
                      staff: 1 full-time (Lowe Lundin), hiring a second; advisors Caleb Parikh and
                      Catherine Low are part-time
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
                      before the end of 2026.
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
                      Apply for a job: they are hiring an{' '}
                      <A href="https://jobs.ashbyhq.com/centreforeffectivealtruism/a14b4d0e-ba00-4bf1-8317-61034ab43d21">
                        Associate Program Officer
                      </A>{' '}
                      (full-time, remote)
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
              fair bit of public info — named focus areas, named grantees, and a team page listing
              11 staff — but they&apos;re still not taking unsolicited funding requests. Based on{' '}
              <A href="https://web.archive.org/web/20260121035945/https://effectivealtruism.nz/job-board/ai-governance-fund-lead-astralis-foundation">
                this job posting
              </A>{' '}
              from late 2025 (now removed from the live job board), they have a fund focused on
              international AI governance, the Shared Horizons fund, aiming to deploy $15m in 2026;
              the same posting says Astralis has raised over $20m for AI safety from 15 donors and
              deployed it to 14 organizations.
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
              <A href="https://futureoflife.org/">FLI</A>: They were previously more active in
              grantmaking, but seem to be less focused on it these days. Their{' '}
              <A href="https://futureoflife.org/grant-program/phd-fellowships/">PhD fellowship</A>{' '}
              is now paused — they aren&apos;t accepting applications in fall 2026 while they
              reassess the program. Their one open program is the{' '}
              <A href="https://futureoflife.org/project/digital-media-accelerator/">
                Digital Media Accelerator
              </A>
              , which funds AI safety content creators on a rolling basis and doesn&apos;t publish
              grant sizes.
            </li>
            <li>
              <A href="https://www.frontiermodelforum.org/ai-safety-fund/">
                Frontier Model Forum AI Safety Fund
              </A>
              : It was funded with $10m in 2023. Most of this was distributed in 2024 and 2025 —
              their most recent grantees were announced in December 2025 — and they now appear to be
              winding down and spending their remaining funds.
            </li>
            <li>
              <A href="https://foresight.org/grants/grants-ai-for-science-safety/">
                Foresight AI for Safety and Science
              </A>
              : They award around $3m annually across AI safety &amp; science, typically $10k-$100k
              per grant. Their current{' '}
              <A href="https://foresight.org/grants/ai-science-safety-nodes-rfp/">
                AI for Science &amp; Safety Nodes RFP
              </A>{' '}
              (deadline October 31, 2026) funds work on local compute, coordination and
              accountability, and AI-first science, typically at $30k-$100k per grant; all funded
              work must be open-sourced. They strongly prefer applicants who will be in-person
              members of their SF or Berlin hubs.
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
              distributed to 33 projects out of 581 applications, averaging around $30k. No second
              round has been announced.
            </li>
            <li>
              <A href="https://www.darpa.mil/research/programs/ai-forge">AI Forge</A>: A joint
              DARPA/NSF program launched in June 2026, working with CAISI at NIST, to fund research
              on AI interpretability, AI control, and adversarial robustness, at roughly $750k-$3m
              per project. It&apos;s restricted to US universities and military service academies,
              and no administering nonprofit has been publicly named as of September 2026.
            </li>
            <li>
              <A href="https://www.iliad.ac/funding">ILIAD</A>: They fund new research organizations
              that meet a high bar of scientific rigor. As of July 2026 they list both a request for
              proposals (epistemics-raising projects and theory-driven research on ReLU networks)
              and a rolling open call for research projects — but still don&apos;t publish grant
              sizes or deadlines.
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
          <A href="https://aisafety.com/funding">https://aisafety.com/funding</A>&nbsp;and subscribe
          to their newsletter at{' '}
          <A href="https://aisafetyfunding.substack.com/">https://aisafetyfunding.substack.com/</A>.
          Manifund also launched <A href="https://trace.manifund.org">Trace</A> in August 2026, a
          database tracking $2.8b of AI safety funding across 4,500+ grants and 700+ funders going
          back to 2003, available as a website, an API, and a bulk download.
        </p>
      </div>
    </div>
  )
}
