// What a fund's page shows beyond its profile: a cover, a one-line mission and the facts in its side card.
// Keyed by the fund's username. A fund without an entry gets its avatar as the cover and no facts.
export type FundPageExtras = {
  cover?: string
  mission?: string
  facts?: { label: string; value: string }[]
}

export const FUND_PAGES: Record<string, FundPageExtras> = {
  sunlight: {
    // A stand-in until we pick a final image
    cover: 'https://cdn.midjourney.com/4fbfb224-177a-4614-8f72-f9caf39bc0a5/0_0.png',
    mission: 'Fast, transparent, early-stage grants for AI safety',
    facts: [
      { label: 'Grant sizes', value: '$1k to $50k' },
      { label: 'Decisions', value: 'Within a week' },
      { label: 'Focus', value: 'AI safety' },
      { label: 'Fee', value: '5% of donations' },
    ],
  },
}
