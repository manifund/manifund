export const CENTS_PER_DOLLAR = 100

// Temporary flag to disable new signups and projects during spambot attack
export const DISABLE_NEW_SIGNUPS_AND_PROJECTS = false
export const SIGNUP_DISABLED_MESSAGE =
  'New projects and accounts disabled as we deal with spambots; contact hi@manifund.org if you have questions.'

// Spam filter (runs before Pangram on project create/edit/publish).
// SPAM_FILTER_ENABLED: master switch. When false, the gate is skipped entirely.
// SPAM_FILTER_ENFORCE: when true, flagged projects are hidden (or the author
//   banned, for accounts < 1 week old) and the creator is emailed. When false,
//   the verdict is only recorded to project_scores.is_spam (shadow mode) so you
//   can review accuracy on live traffic before turning on enforcement.
export const SPAM_FILTER_ENABLED = true
export const SPAM_FILTER_ENFORCE = true

// Mercury-backed withdrawals (large or international; Stripe Connect still
// handles self-serve US withdrawals under $10k).
// MERCURY_ENABLED: master switch. When false the withdraw page keeps linking to
//   the old Airtable form, so this can ship dark and be tested in production.
// MERCURY_REQUIRE_TAX_DOCUMENT: makes Mercury collect a W-9/W-8BEN during
//   recipient onboarding. Off until someone owning compliance says otherwise.
export const MERCURY_ENABLED = false
export const MERCURY_REQUIRE_TAX_DOCUMENT = false

// Floor for Mercury withdrawals only -- the Stripe path keeps its $1 minimum.
// An international wire costs a flat $15 whatever the size, and small requests
// are the ones that linger in the queue. Capped at the full balance so someone
// with less than $1k withdraws all of it rather than being locked out.
export const MERCURY_MIN_WITHDRAWAL = 1000
export function mercuryMinWithdrawal(withdrawBalance: number) {
  return Math.min(MERCURY_MIN_WITHDRAWAL, withdrawBalance)
}

export function getURL() {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to including trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  return url
}

export function getRoundTheme(roundTitle: string) {
  switch (roundTitle) {
    case 'ACX Mini-Grants':
      return 'indigo'
    case 'OP AI Worldviews Contest':
      return 'sky'
    case 'Independent':
      return 'gray'
    case 'Regrants':
      return 'rose'
    case 'Regranters':
      return 'rose'
    case 'Manifold Community Fund':
      return 'indigo'
    default:
      return 'pink' //this should never happen
  }
}

export function getSponsoredAmount2023(regrantorId: string) {
  const sponsoredRegrantors = {
    'e083e3b0-a131-4eaa-8a83-6a146a196432': 50_000, // Isaak
    '4de2634d-3802-4141-881e-9ce687f87485': 50_000, // Rachel
    '10bd8a14-4002-47ff-af4a-92b227423a74': 50_000, // Austin
    '74f76b05-0e51-407e-82c3-1fb19518933c': 50_000, // Gavriel
    'fb21e9f3-9b84-4556-9228-2b65bc85a9dc': 50_000, // Zvi
    '0f0dd540-40a4-4976-a145-c6e82c2e98f5': 50_000, // Ted
    '8aa331b7-3602-4001-9bc6-2b71b1c8ddd1': 50_000, // Renan
    'aa7c88dc-7311-4577-8cd3-c58a0d41fc31': 50_000, // Joel
    'e2a30cdd-6797-4e2c-8823-f051195fc77a': 50_000, // Ryan
    '232dc139-961a-4f9a-9ca5-0118b90287c0': 50_000, // Nuno
    'b11620f2-fdc7-414c-8a63-9ddee17ee669': 100_000, // Marcus
    '1398ed62-4213-4923-a84e-a9931ae19492': 400_000, // Adam
    '94a0c7b8-39fd-4856-a7e6-1f9429dbb4ad': 400_000, // Dan Hendrycks
    'c0319265-58b4-40e3-821c-5d32a76cd650': 400_000, // Tristan
    '647c9b3c-65ce-40cf-9464-ac02c741aacd': 450_000, // Evan
    '75420de8-7e37-4971-bb29-9bfada0c453b': 400_000, // Leopold
  } as { [key: string]: number }
  return sponsoredRegrantors[regrantorId] ?? 0
}

export function getSponsoredAmount2024(regrantorId: string) {
  const sponsoredRegrantors = {
    '1398ed62-4213-4923-a84e-a9931ae19492': 250_000, // Adam
    '94a0c7b8-39fd-4856-a7e6-1f9429dbb4ad': 250_000, // Dan Hendrycks
    '647c9b3c-65ce-40cf-9464-ac02c741aacd': 250_000, // Evan
    '75420de8-7e37-4971-bb29-9bfada0c453b': 250_000, // Leopold
    'e2a30cdd-6797-4e2c-8823-f051195fc77a': 250_000, // Ryan
    'e9362a95-cbec-4685-b179-91b4c5ba4edc': 250_000, // Neel Nanda
  } as { [key: string]: number }
  return sponsoredRegrantors[regrantorId] ?? 0
}

export function getSponsoredAmount2025(regrantorId: string) {
  // Total allocated: $2,075,000 of $2,250,000
  const sponsoredRegrantors = {
    'e9362a95-cbec-4685-b179-91b4c5ba4edc': 350_000, // Neel Nanda
    '4988c7d8-e1a6-4f2b-b9d9-f80cd02f1732': 100_000, // Lisa
    'aa7c88dc-7311-4577-8cd3-c58a0d41fc31': 350_000, // Joel
    'dd68802c-760d-4241-9431-352e1f635f6a': 100_000, // Lauren
    '8a2d245e-1cfe-4d93-8a74-82b2ed695f24': 175_000, // Gavin
    '9af369f0-dc1e-4577-9bb7-4ad4cb87131f': 100_000, // Marius
    '64803b9c-02ff-4d4f-9f4a-3261c8ef60f6': 100_000, // Thomas
    '7901a82c-00b3-40e6-ac1c-f56ff672fb18': 100_000, // Tamay
    '75d73803-3b02-4e20-826c-c7bd96127a9e': 125_000, // Richard
    'e2a30cdd-6797-4e2c-8823-f051195fc77a': 175_000, // Ryan
    'b11620f2-fdc7-414c-8a63-9ddee17ee669': 125_000, // Marcus
    'a3a0607a-b240-47ff-9025-77e6453f171f': 150_000, // Ethan
    '3f45ee75-65b2-4768-9101-bbd628747661': 125_000, // Alexandra
  } as { [key: string]: number }
  return sponsoredRegrantors[regrantorId] ?? 0
}

export function getSponsoredAmount2026(regrantorId: string) {
  return SPONSORED_REGRANTORS_2026[regrantorId] ?? 0
}

// 2026 program: regrantors with a $0 budget are in the program (and shown on
// the regranting page) but have no sponsored budget allocated yet.
const SPONSORED_REGRANTORS_2026 = {
  'aa284776-0f93-4a91-89fa-242cfea631e6': 50_000, // Keri Warr
  'e9362a95-cbec-4685-b179-91b4c5ba4edc': 0, // Neel Nanda
  '4988c7d8-e1a6-4f2b-b9d9-f80cd02f1732': 0, // Lisa
  'aa7c88dc-7311-4577-8cd3-c58a0d41fc31': 0, // Joel
  'dd68802c-760d-4241-9431-352e1f635f6a': 0, // Lauren
  '8a2d245e-1cfe-4d93-8a74-82b2ed695f24': 0, // Gavin
  '9af369f0-dc1e-4577-9bb7-4ad4cb87131f': 0, // Marius
  '64803b9c-02ff-4d4f-9f4a-3261c8ef60f6': 0, // Thomas
  '7901a82c-00b3-40e6-ac1c-f56ff672fb18': 0, // Tamay
  '75d73803-3b02-4e20-826c-c7bd96127a9e': 0, // Richard
  'e2a30cdd-6797-4e2c-8823-f051195fc77a': 0, // Ryan
  'b11620f2-fdc7-414c-8a63-9ddee17ee669': 0, // Marcus
  'a3a0607a-b240-47ff-9025-77e6453f171f': 0, // Ethan
  '3f45ee75-65b2-4768-9101-bbd628747661': 0, // Alexandra
  'd0445b0c-d287-4634-b918-a073cfcc00b2': 0, // Roy Rinberg
} as { [key: string]: number }

// Whether this regrantor is part of the given year's program, regardless of
// budget (unlike getSponsoredAmount, which is 0 for $0-budget members).
export function isSponsoredRegrantor(regrantorId: string, year: number) {
  if (year === 2026) {
    return regrantorId in SPONSORED_REGRANTORS_2026
  }
  return getSponsoredAmount(regrantorId, year) !== 0
}

export function getSponsoredAmount(regrantorId: string, year?: number) {
  if (year === 2023) {
    return getSponsoredAmount2023(regrantorId)
  } else if (year === 2024) {
    return getSponsoredAmount2024(regrantorId)
  } else if (year === 2025) {
    return getSponsoredAmount2025(regrantorId)
  } else if (year === 2026) {
    return getSponsoredAmount2026(regrantorId)
  } else {
    return (
      getSponsoredAmount2023(regrantorId) +
      getSponsoredAmount2024(regrantorId) +
      getSponsoredAmount2025(regrantorId) +
      getSponsoredAmount2026(regrantorId)
    )
  }
}

// Needed for people who are both accredited investors and regrantors
const CHARITABLE_DEPOSITS = [
  '1e17c09d-aa7f-432a-b523-89691531b304', // $50k from Manifund Bank to Zvi
  'c223e240-598f-41a9-8aa0-7a961d8db258', // $50k from Manifund Bank to Austin
]
export function isCharitableDeposit(txnId: string) {
  return CHARITABLE_DEPOSITS.includes(txnId)
}

export const CURRENT_AGREEMENT_VERSION = 3

// The org/fiscal-sponsor agreement is a separate document with its own version
// line, not a variant of the individual one, so the two can evolve
// independently. See docs/org-grant-agreements-plan.md.
export const CURRENT_ORG_AGREEMENT_VERSION = 1
