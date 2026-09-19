export interface CharityData {
  ticker: string
  name: string
  currentPrice: number
  priceChange: number
  volume24h: number
  shareholders: number
  marketCap: number
  description: string
  founded: string
  website: string
  iconUrl?: string
  priceHistory: Array<{
    date: string
    price: number
    volume: number
  }>
  recentNews: Array<{
    date: string
    headline: string
    content: string
  }>
  topShareholders: Array<{
    name: string
    shares: number
    percentage: number
  }>
}

export const DUMMY_CHARITY_DATA: Record<string, CharityData[]> = {
  'Technical AI Safety': [
    {
      ticker: 'MIRI',
      name: 'Machine Intelligence Research Institute',
      currentPrice: 125.5,
      priceChange: 2.3,
      volume24h: 45000,
      shareholders: 234,
      marketCap: 2850000,
      description:
        'Researching mathematical foundations of artificial intelligence alignment.',
      founded: '2000',
      website: 'https://intelligence.org',
      iconUrl:
        'https://intelligence.org/wp-content/uploads/2024/10/Group-26.png',
      priceHistory: generatePriceHistory(125.5, 30),
      recentNews: [
        {
          date: '2025-01-15',
          headline: 'MIRI announces new alignment research breakthrough',
          content:
            'Researchers publish paper on formal verification methods for AI systems.',
        },
        {
          date: '2025-01-10',
          headline: 'Partnership with top universities announced',
          content:
            'MIRI partners with MIT and Stanford for expanded research collaboration.',
        },
      ],
      topShareholders: [
        {
          name: 'Effective Ventures Foundation',
          shares: 5000,
          percentage: 22.1,
        },
        {
          name: 'Future of Humanity Institute',
          shares: 3200,
          percentage: 14.1,
        },
        { name: 'Individual Investors', shares: 14500, percentage: 63.8 },
      ],
    },
    {
      ticker: 'CHAI',
      name: 'Center for Human-Compatible AI',
      currentPrice: 89.25,
      priceChange: -1.2,
      volume24h: 32000,
      shareholders: 187,
      marketCap: 1950000,
      description:
        'Berkeley-based research center focused on AI alignment and safety.',
      founded: '2016',
      website: 'https://humancompatible.ai',
      iconUrl: 'https://humancompatible.ai/favicon.ico',
      priceHistory: generatePriceHistory(89.25, 30),
      recentNews: [
        {
          date: '2025-01-12',
          headline: 'New grant funding secured for next 3 years',
          content:
            'CHAI secures $15M in funding from major tech companies for safety research.',
        },
      ],
      topShareholders: [
        { name: 'UC Berkeley', shares: 2800, percentage: 12.8 },
        { name: 'Open Philanthropy', shares: 4500, percentage: 20.5 },
        { name: 'Individual Investors', shares: 14650, percentage: 66.7 },
      ],
    },
    {
      ticker: 'AISI',
      name: 'AI Safety Institute',
      currentPrice: 156.8,
      priceChange: 4.7,
      volume24h: 67000,
      shareholders: 312,
      marketCap: 4200000,
      description: 'UK government institute for AI safety research and policy.',
      founded: '2023',
      website: 'https://aisi.gov.uk',
      iconUrl:
        'https://cdn.prod.website-files.com/663bd486c5e4c81588db7a1d/6851b4a9c117f83c4217e827_AISI%20icon%2032.png',
      priceHistory: generatePriceHistory(156.8, 30),
      recentNews: [
        {
          date: '2025-01-14',
          headline: 'Government increases AI safety funding',
          content:
            'UK announces £100M additional funding for AI safety research.',
        },
      ],
      topShareholders: [
        { name: 'UK Government', shares: 8000, percentage: 29.9 },
        { name: 'Academic Institutions', shares: 6500, percentage: 24.3 },
        { name: 'Individual Investors', shares: 12250, percentage: 45.8 },
      ],
    },
    {
      ticker: 'REDW',
      name: 'Redwood Research',
      currentPrice: 72.4,
      priceChange: 1.8,
      volume24h: 28000,
      shareholders: 156,
      marketCap: 1680000,
      description:
        'AI safety research organization focusing on interpretability and alignment.',
      founded: '2021',
      website: 'https://redwoodresearch.org',
      iconUrl: 'https://www.redwoodresearch.org/icon.png?99d7085f2ee4ed1d',
      priceHistory: generatePriceHistory(72.4, 30),
      recentNews: [
        {
          date: '2025-01-11',
          headline: 'New interpretability tool released',
          content:
            'Open source tool for neural network interpretation gains industry adoption.',
        },
      ],
      topShareholders: [
        { name: 'Effective Altruism Funds', shares: 3500, percentage: 15.1 },
        { name: 'Tech Industry Leaders', shares: 5800, percentage: 25.0 },
        { name: 'Individual Investors', shares: 13900, percentage: 59.9 },
      ],
    },
    {
      ticker: 'ANTHC',
      name: 'Anthropic',
      currentPrice: 245.9,
      priceChange: 3.2,
      volume24h: 125000,
      shareholders: 567,
      marketCap: 12300000,
      description:
        'AI safety company focused on developing safe, beneficial AI systems.',
      founded: '2021',
      website: 'https://anthropic.com',
      iconUrl:
        'https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/681d52619fec35886a7f1a70_favicon.png',
      priceHistory: generatePriceHistory(245.9, 30),
      recentNews: [
        {
          date: '2025-01-13',
          headline: 'Claude 4 safety benchmarks exceed expectations',
          content:
            'New model shows significant improvements in alignment and safety metrics.',
        },
      ],
      topShareholders: [
        { name: 'Google', shares: 8000, percentage: 16.0 },
        { name: 'Spark Capital', shares: 6000, percentage: 12.0 },
        { name: 'Individual Investors', shares: 36000, percentage: 72.0 },
      ],
    },
    {
      ticker: 'APOL',
      name: 'Apollo Research',
      currentPrice: 61.2,
      priceChange: 2.1,
      volume24h: 22000,
      shareholders: 110,
      marketCap: 673200,
      description:
        'Research organization advancing AI alignment and interpretability.',
      founded: '2022',
      website: 'https://apolloresearch.ai',
      iconUrl:
        'https://images.squarespace-cdn.com/content/v1/6593e7097565990e65c886fd/6d42360e-c273-4f7e-b4de-70488cefa95c/favicon.ico',
      priceHistory: generatePriceHistory(61.2, 30),
      recentNews: [
        {
          date: '2025-01-10',
          headline: 'Apollo launches new interpretability challenge',
          content:
            'Apollo Research invites the community to participate in a novel interpretability benchmark.',
        },
      ],
      topShareholders: [
        { name: 'Open Philanthropy', shares: 2000, percentage: 18.2 },
        { name: 'Apollo Team', shares: 3000, percentage: 27.3 },
        { name: 'Individual Investors', shares: 6000, percentage: 54.5 },
      ],
    },
    {
      ticker: 'TIMAE',
      name: 'Timaeus',
      currentPrice: 44.7,
      priceChange: -0.9,
      volume24h: 9000,
      shareholders: 67,
      marketCap: 299490,
      description:
        'Nonprofit focused on foundational research in AI safety and philosophy.',
      founded: '2023',
      website: 'https://timaeus.ai',
      iconUrl: 'https://timaeus.co/apple-touch-icon.png',
      priceHistory: generatePriceHistory(44.7, 30),
      recentNews: [
        {
          date: '2025-01-12',
          headline: 'Timaeus publishes report on AI value alignment',
          content:
            'A new whitepaper explores the philosophical underpinnings of value alignment in AI systems.',
        },
      ],
      topShareholders: [
        { name: 'Effective Altruism Funds', shares: 1200, percentage: 17.9 },
        { name: 'Timaeus Founders', shares: 1800, percentage: 26.9 },
        { name: 'Individual Investors', shares: 3680, percentage: 55.2 },
      ],
    },
    {
      ticker: 'FAR',
      name: 'FAR AI',
      currentPrice: 53.5,
      priceChange: 1.3,
      volume24h: 15000,
      shareholders: 89,
      marketCap: 476150,
      description:
        'Nonprofit research lab dedicated to scalable oversight and robust AI alignment.',
      founded: '2021',
      website: 'https://far.ai',
      iconUrl:
        'https://cdn.prod.website-files.com/66f4503c3d0f4d4a75074a18/6711a658d6ce0b4be55a68ab_FAR-AI-32logoicon.png',
      priceHistory: generatePriceHistory(53.5, 30),
      recentNews: [
        {
          date: '2025-01-14',
          headline: 'FAR AI receives grant for scalable oversight research',
          content:
            'FAR AI secures new funding to expand its scalable oversight research program.',
        },
      ],
      topShareholders: [
        { name: 'Open Philanthropy', shares: 1500, percentage: 18.2 },
        { name: 'FAR AI Team', shares: 2000, percentage: 24.7 },
        { name: 'Individual Investors', shares: 4600, percentage: 57.1 },
      ],
    },
  ],
  'AI Governance': [
    {
      ticker: 'FHI',
      name: 'Future of Humanity Institute',
      currentPrice: 98.75,
      priceChange: -0.5,
      volume24h: 41000,
      shareholders: 203,
      marketCap: 2250000,
      description:
        'Oxford-based institute researching existential risks and AI governance.',
      founded: '2005',
      website: 'https://fhi.ox.ac.uk',
      priceHistory: generatePriceHistory(98.75, 30),
      recentNews: [
        {
          date: '2025-01-09',
          headline: 'New policy recommendations published',
          content:
            'FHI releases comprehensive framework for AI governance and regulation.',
        },
      ],
      topShareholders: [
        { name: 'Oxford University', shares: 4500, percentage: 19.7 },
        { name: 'Open Philanthropy', shares: 6000, percentage: 26.3 },
        { name: 'Individual Investors', shares: 12300, percentage: 54.0 },
      ],
    },
    {
      ticker: 'CSET',
      name: 'Center for Security & Emerging Technology',
      currentPrice: 134.2,
      priceChange: 2.8,
      volume24h: 38000,
      shareholders: 178,
      marketCap: 2850000,
      description:
        'Georgetown policy research center focused on AI and emerging tech governance.',
      founded: '2019',
      website: 'https://cset.georgetown.edu',
      priceHistory: generatePriceHistory(134.2, 30),
      recentNews: [
        {
          date: '2025-01-08',
          headline: 'Congressional briefing on AI regulation',
          content:
            'CSET experts testify before House committee on AI oversight needs.',
        },
      ],
      topShareholders: [
        { name: 'Georgetown University', shares: 3200, percentage: 15.1 },
        { name: 'Schmidt Futures', shares: 5500, percentage: 25.9 },
        { name: 'Individual Investors', shares: 12550, percentage: 59.0 },
      ],
    },
    {
      ticker: 'PFAI',
      name: 'Partnership on AI',
      currentPrice: 67.3,
      priceChange: 0.9,
      volume24h: 22000,
      shareholders: 134,
      marketCap: 1450000,
      description: 'Industry consortium for AI safety and beneficial outcomes.',
      founded: '2016',
      website: 'https://partnershiponai.org',
      priceHistory: generatePriceHistory(67.3, 30),
      recentNews: [
        {
          date: '2025-01-07',
          headline: 'New member companies join consortium',
          content: 'Three major tech companies commit to AI safety standards.',
        },
      ],
      topShareholders: [
        { name: 'Tech Consortium Members', shares: 8500, percentage: 39.4 },
        { name: 'Non-profit Partners', shares: 4200, percentage: 19.4 },
        { name: 'Individual Investors', shares: 8900, percentage: 41.2 },
      ],
    },
    {
      ticker: 'CAIS',
      name: 'Center for AI Safety',
      currentPrice: 187.6,
      priceChange: 5.4,
      volume24h: 89000,
      shareholders: 287,
      marketCap: 4890000,
      description:
        'Research and advocacy organization focused on reducing AI-related risks.',
      founded: '2022',
      website: 'https://safe.ai',
      priceHistory: generatePriceHistory(187.6, 30),
      recentNews: [
        {
          date: '2025-01-16',
          headline: 'AI Safety Statement reaches 1000 signatures',
          content:
            'Leading AI researchers and executives sign statement on AI extinction risk.',
        },
      ],
      topShareholders: [
        { name: 'Effective Altruism Funds', shares: 4500, percentage: 17.3 },
        { name: 'Future Fund', shares: 6800, percentage: 26.1 },
        { name: 'Individual Investors', shares: 14750, percentage: 56.6 },
      ],
    },
  ],
  'EA Community': [
    {
      ticker: 'CEA',
      name: 'Centre for Effective Altruism',
      currentPrice: 76.85,
      priceChange: 1.6,
      volume24h: 35000,
      shareholders: 298,
      marketCap: 2180000,
      description:
        'Building the effective altruism community and movement worldwide.',
      founded: '2012',
      website: 'https://centreforeffectivealtruism.org',
      priceHistory: generatePriceHistory(76.85, 30),
      recentNews: [
        {
          date: '2025-01-05',
          headline: 'EA Global 2025 registration opens',
          content:
            'Annual conference to feature 100+ speakers on effective giving and impact.',
        },
      ],
      topShareholders: [
        { name: 'EA Infrastructure Fund', shares: 5200, percentage: 18.3 },
        { name: 'Open Philanthropy', shares: 7500, percentage: 26.4 },
        { name: 'Individual Donors', shares: 15750, percentage: 55.3 },
      ],
    },
    {
      ticker: 'OPEN',
      name: 'Open Philanthropy',
      currentPrice: 295.4,
      priceChange: 2.1,
      volume24h: 156000,
      shareholders: 412,
      marketCap: 14750000,
      description:
        'Research and grantmaking foundation identifying outstanding giving opportunities.',
      founded: '2011',
      website: 'https://openphilanthropy.org',
      priceHistory: generatePriceHistory(295.4, 30),
      recentNews: [
        {
          date: '2025-01-03',
          headline: '$200M committed to AI safety research',
          content:
            'Major funding round supports next-generation alignment research.',
        },
      ],
      topShareholders: [
        { name: 'Good Ventures', shares: 12000, percentage: 24.0 },
        { name: 'Dustin Moskovitz', shares: 8500, percentage: 17.0 },
        { name: 'Individual Investors', shares: 29500, percentage: 59.0 },
      ],
    },
    {
      ticker: 'GWWC',
      name: 'Giving What We Can',
      currentPrice: 42.3,
      priceChange: 0.8,
      volume24h: 18000,
      shareholders: 867,
      marketCap: 1890000,
      description:
        'Community of people donating effectively to help others as much as possible.',
      founded: '2009',
      website: 'https://givingwhatwecan.org',
      priceHistory: generatePriceHistory(42.3, 30),
      recentNews: [
        {
          date: '2025-01-01',
          headline: '10,000th pledge milestone reached',
          content:
            'Community surpasses 10,000 members committed to effective giving.',
        },
      ],
      topShareholders: [
        { name: 'EA Community Fund', shares: 6500, percentage: 14.5 },
        {
          name: 'Centre for Effective Altruism',
          shares: 8200,
          percentage: 18.3,
        },
        { name: 'Individual Pledgers', shares: 30100, percentage: 67.2 },
      ],
    },
    {
      ticker: '80K',
      name: '80,000 Hours',
      currentPrice: 54.7,
      priceChange: -0.3,
      volume24h: 21000,
      shareholders: 234,
      marketCap: 1250000,
      description:
        'Career advice organization helping people find high-impact careers.',
      founded: '2011',
      website: 'https://80000hours.org',
      priceHistory: generatePriceHistory(54.7, 30),
      recentNews: [
        {
          date: '2024-12-28',
          headline: 'AI safety career guide updated',
          content:
            'Comprehensive guide covers technical and policy career paths.',
        },
      ],
      topShareholders: [
        {
          name: 'Centre for Effective Altruism',
          shares: 3500,
          percentage: 15.3,
        },
        { name: 'Open Philanthropy', shares: 5800, percentage: 25.4 },
        { name: 'Individual Supporters', shares: 13550, percentage: 59.3 },
      ],
    },
  ],
  'Animal Welfare': [
    {
      ticker: 'GFI',
      name: 'Good Food Institute',
      currentPrice: 143.25,
      priceChange: 6.2,
      volume24h: 78000,
      shareholders: 456,
      marketCap: 6890000,
      description:
        'Accelerating alternative protein innovation to create a food system without animals.',
      founded: '2016',
      website: 'https://gfi.org',
      priceHistory: generatePriceHistory(143.25, 30),
      recentNews: [
        {
          date: '2025-01-04',
          headline: 'Plant-based meat sales surge 40%',
          content:
            'GFI report shows record growth in alternative protein market adoption.',
        },
      ],
      topShareholders: [
        { name: 'Open Philanthropy', shares: 8500, percentage: 17.7 },
        { name: 'Animal Welfare Fund', shares: 6200, percentage: 12.9 },
        { name: 'Individual Investors', shares: 33350, percentage: 69.4 },
      ],
    },
    {
      ticker: 'ACE',
      name: 'Animal Charity Evaluators',
      currentPrice: 67.9,
      priceChange: 1.4,
      volume24h: 29000,
      shareholders: 187,
      marketCap: 1890000,
      description:
        'Research organization finding and promoting effective animal advocacy.',
      founded: '2012',
      website: 'https://animalcharityevaluators.org',
      priceHistory: generatePriceHistory(67.9, 30),
      recentNews: [
        {
          date: '2024-12-30',
          headline: '2024 charity recommendations released',
          content:
            'Four top charities selected for maximum impact per donation dollar.',
        },
      ],
      topShareholders: [
        { name: 'EA Animal Welfare Fund', shares: 4200, percentage: 15.1 },
        { name: 'Individual EA Donors', shares: 12500, percentage: 44.9 },
        { name: 'Animal Rights Supporters', shares: 11150, percentage: 40.0 },
      ],
    },
    {
      ticker: 'THL',
      name: 'The Humane League',
      currentPrice: 89.6,
      priceChange: 3.7,
      volume24h: 43000,
      shareholders: 312,
      marketCap: 3450000,
      description:
        'Ending the abuse of animals raised for food through corporate and institutional reform.',
      founded: '2005',
      website: 'https://thehumaneleague.org',
      priceHistory: generatePriceHistory(89.6, 30),
      recentNews: [
        {
          date: '2025-01-02',
          headline: 'Major food chain adopts cage-free pledge',
          content:
            'Corporate campaign success affects 50 million hens annually.',
        },
      ],
      topShareholders: [
        { name: 'Open Philanthropy', shares: 5500, percentage: 14.3 },
        { name: 'Animal Welfare Donors', shares: 15200, percentage: 39.5 },
        { name: 'Individual Supporters', shares: 17800, percentage: 46.2 },
      ],
    },
    {
      ticker: 'FIAPO',
      name: 'Faunalytics',
      currentPrice: 34.8,
      priceChange: -1.1,
      volume24h: 15000,
      shareholders: 98,
      marketCap: 980000,
      description:
        'Research organization providing data and analysis to animal advocates.',
      founded: '2000',
      website: 'https://faunalytics.org',
      priceHistory: generatePriceHistory(34.8, 30),
      recentNews: [
        {
          date: '2024-12-27',
          headline: 'Comprehensive study on meat reduction published',
          content:
            'Research reveals most effective messaging for dietary change.',
        },
      ],
      topShareholders: [
        { name: 'Animal Charity Evaluators', shares: 2800, percentage: 9.9 },
        { name: 'EA Animal Welfare Fund', shares: 4500, percentage: 16.0 },
        { name: 'Research Community', shares: 20850, percentage: 74.1 },
      ],
    },
  ],
}

function generatePriceHistory(
  currentPrice: number,
  days: number
): Array<{ date: string; price: number; volume: number }> {
  const history = []
  const baseVolume = Math.floor(Math.random() * 50000) + 10000

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    const volatility = 0.05
    const trend = -0.001
    const randomFactor = (Math.random() - 0.5) * 2 * volatility
    const trendFactor = i * trend

    const price = currentPrice * (1 + trendFactor + randomFactor)
    const volume = baseVolume * (0.8 + Math.random() * 0.4)

    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.max(price, 1),
      volume: Math.floor(volume),
    })
  }

  return history
}
