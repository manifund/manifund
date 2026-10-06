// Sample data for the /design-sync previews. Shapes follow db/profile.ts and
// db/project.ts; only the fields the previewed components read are meaningful.
export const profile: any = {
  id: '7c1e2b9a-3f4d-4c8e-9a51-2d6f0b8e4a13',
  username: 'mariahobbs',
  full_name: 'Maria Hobbs',
  avatar_url: null,
  bio: 'Researcher working on interpretability for large language models. Previously at a biosecurity think tank.',
  website: 'mariahobbs.org',
  type: 'individual',
  regranter_status: false,
}

export const regrantor: any = {
  ...profile,
  id: '2a9d4f70-8b1c-4e57-b6a3-91c5e0d7f284',
  username: 'NeelNanda',
  full_name: 'Neel Nanda',
  bio: 'Mechanistic interpretability lead. Regranting toward early-career alignment researchers.',
  website: null,
  regranter_status: true,
}

export const project: any = {
  id: 'b41f6c1e-55a0-4d0b-8a7e-0c9f3d2e6b18',
  slug: 'open-interpretability-benchmarks',
  title: 'Open benchmarks for sparse autoencoder evaluation',
  blurb:
    'A public suite of tasks and reference results for comparing sparse autoencoders across model families.',
  creator: profile.id,
  type: 'grant',
  stage: 'proposal',
  funding_goal: 40000,
  min_funding: 10000,
  amm_shares: null,
  ai_fraction: null,
  profiles: profile,
  bids: [
    { id: 'b1', bidder: 'd1', type: 'donate', status: 'pending', amount: 12000 },
    { id: 'b2', bidder: 'd2', type: 'donate', status: 'pending', amount: 6500 },
  ],
  txns: [],
  comments: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }],
  project_votes: [{ magnitude: 1 }, { magnitude: 1 }, { magnitude: 1 }, { magnitude: -1 }],
  project_transfers: [],
  project_follows: [],
  causes: [
    { slug: 'tais', title: 'Technical AI safety' },
    { slug: 'science', title: 'Science & technology' },
  ],
}

export const activeProject: any = {
  ...project,
  id: 'e7a2d9c4-1b36-4f58-a0c7-6d5e4f3b2a10',
  slug: 'wastewater-pathogen-monitoring',
  title: 'Wastewater pathogen monitoring pilot',
  blurb: 'Six months of metagenomic sequencing at three regional treatment plants.',
  stage: 'active',
  funding_goal: 85000,
  min_funding: 30000,
  profiles: regrantor,
  creator: regrantor.id,
  bids: [],
  txns: [
    { id: 't1', to_id: regrantor.id, from_id: 'd1', token: 'USD', amount: 45000 },
    { id: 't2', to_id: regrantor.id, from_id: 'd2', token: 'USD', amount: 17500 },
  ],
  comments: [{ id: 'c1' }, { id: 'c2' }],
  project_votes: [{ magnitude: 1 }, { magnitude: 1 }],
  causes: [{ slug: 'biosec', title: 'Biosecurity' }],
}
