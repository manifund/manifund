import type { Database } from '@/db/database.types'

type OrgInsert = Database['public']['Tables']['orgs']['Insert']

// The curated org pages, keyed by slug. `bun scripts/seed-orgs.ts` upserts these into public.orgs, writing
// only the fields given here: anything edited by hand in the database and not listed below is left alone.
// Legal fields stay out until someone has checked them against the org's filings.
export const ORGS: (OrgInsert & { slug: string; name: string })[] = [
  {
    slug: 'metr',
    name: 'METR',
    website: 'https://metr.org',
    summary:
      'Builds and runs evaluations that measure whether frontier AI systems can carry out long, autonomous tasks.',
    city: 'Berkeley, CA',
    founded_year: 2022,
    trace_slug: 'model-evaluation-and-threat-research',
  },
  {
    slug: 'longview',
    name: 'Longview Philanthropy',
    website: 'https://www.longview.org',
    summary:
      'Advises major donors and runs funds for reducing risks from AI, nuclear weapons and pandemics.',
    city: 'London',
    founded_year: 2018,
    trace_slug: 'longview-philanthropy',
  },
  {
    slug: 'epoch',
    name: 'Epoch AI',
    website: 'https://epoch.ai',
    summary:
      'Researches the trajectory of AI: compute, training data, benchmarks and economic impact.',
    founded_year: 2022,
    trace_slug: 'epoch-ai',
  },
  {
    slug: 'mats',
    name: 'MATS',
    website: 'https://www.matsprogram.org',
    summary: 'A research and training program pairing emerging AI safety researchers with mentors.',
    city: 'Berkeley, CA',
    founded_year: 2021,
    trace_slug: 'mats-research',
  },
  {
    slug: 'cais',
    name: 'Center for AI Safety',
    website: 'https://safe.ai',
    summary: 'Research, field-building and advocacy to reduce societal-scale risks from AI.',
    city: 'San Francisco, CA',
    founded_year: 2022,
    trace_slug: 'center-for-ai-safety',
  },
  {
    slug: '1day-sooner',
    name: '1Day Sooner',
    website: 'https://www.1daysooner.org',
    summary:
      'Advocates for challenge-trial volunteers and for faster development of vaccines and treatments.',
    founded_year: 2020,
    trace_slug: '1day-sooner',
  },
  { slug: 'humans-first', name: 'Humans First', trace_slug: 'humans-first' },
  // Already in the table with their own summary and about text: only the links to Trace are added.
  {
    slug: 'lightcone',
    name: 'Lightcone Infrastructure',
    city: 'Berkeley, CA',
    trace_slug: 'lightcone-infrastructure',
  },
  // Trace has four rows for Forethought; this is the one with most of its grants until they're merged there.
  { slug: 'forethought', name: 'Forethought Foundation', trace_slug: 'forethought' },
  { slug: 'mox', name: 'Mox', city: 'San Francisco, CA', trace_slug: 'mox' },
  {
    slug: 'tarbell',
    name: 'Tarbell Center for AI Journalism',
    trace_slug: 'tarbell-center-for-ai-journalism',
  },
  { slug: 'transluce', name: 'Transluce', trace_slug: 'transluce' },
]
