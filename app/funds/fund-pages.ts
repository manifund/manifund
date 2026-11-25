// What a fund's page shows beyond its profile: a cover, a one-line mission and the facts in its side card.
// Keyed by the fund's username. A fund without an entry gets its avatar as the cover and no facts.
export type FundPageExtras = {
  cover?: string
  mission?: string
  facts?: { label: string; value: string }[]
  // Leave out the Applications section and its tab, for a fund that considers any public proposal
  hideApplications?: boolean
}

export const FUND_PAGES: Record<string, FundPageExtras> = {
  sunlight: {
    // Rehosted from Midjourney, whose CDN refuses server fetches (the preview card needs one)
    cover:
      'https://fkousziwzbnkdkldjper.supabase.co/storage/v1/object/public/image-uploads/funds/sunlight-cover.jpg',
    mission: 'Fast, transparent, early-stage grants for AI safety',
    facts: [
      { label: 'Grant sizes', value: '$1k to $50k' },
      { label: 'Decisions', value: 'Within a week' },
      { label: 'Focus', value: 'AI safety' },
      { label: 'Fee', value: '5% of donations' },
    ],
    hideApplications: true,
  },
}
