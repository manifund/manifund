// How a hold's categories read to the public (C40) and in the admin queues. Client-safe.
export const CATEGORY_LABELS: Record<string, string> = {
  scam_phishing: 'possible scam or phishing',
  impersonation: 'possible impersonation',
  spam: 'possible spam',
  harassment: 'possible harassment',
  doxxing: 'possible private information',
  offensive: 'possibly offensive',
}

export const categoryText = (categories: string[] | null | undefined) =>
  (categories ?? []).map((c) => CATEGORY_LABELS[c] ?? c).join(', ')
