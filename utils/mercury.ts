// Mercury Bank API client. No SDK exists, so this is a thin fetch wrapper.

const MERCURY_API = 'https://api.mercury.com/api/v1'

// Env var names match the unmerged withdraw-mercury branch, in case those
// secrets are already set in Vercel.
export function hasMercuryKeys() {
  return Boolean(process.env.MERCURY_API_KEY) && Boolean(process.env.MERCURY_GRANTS_ACCOUNT_ID)
}

export type PaymentMethod = 'ach' | 'internationalWire'
export type InviteStatus = 'created' | 'completed' | 'expired'
export type ApprovalStatus = 'pendingApproval' | 'approved' | 'rejected' | 'cancelled'

export type RecipientInvite = {
  id: string
  status: InviteStatus
  onboardingUrl?: string
  recipientId?: string
  expiresAt?: string | null
}

export type SendMoneyRequest = {
  requestId: string
  status: ApprovalStatus
  amount: number
  recipientId: string
}

export type MercuryTransaction = {
  id: string
  status: string
  amount: number
  createdAt?: string | null
  postedAt?: string | null
  note?: string | null
  externalMemo?: string | null
  counterpartyId?: string | null
  counterpartyName?: string | null
}

async function mercuryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.MERCURY_API_KEY
  if (!apiKey) throw new Error('Missing MERCURY_API_KEY')
  const res = await fetch(`${MERCURY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(
      `Mercury ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`
    )
  }
  return (await res.json()) as T
}

function grantsAccountId() {
  const id = process.env.MERCURY_GRANTS_ACCOUNT_ID
  if (!id) throw new Error('Missing MERCURY_GRANTS_ACCOUNT_ID')
  return id
}

export async function createRecipientInvite(props: {
  name: string
  contactEmail: string
  paymentMethod: PaymentMethod
  requireTaxDocument: boolean
}) {
  const { name, contactEmail, paymentMethod, requireTaxDocument } = props
  return await mercuryFetch<RecipientInvite>('/recipients/invites', {
    method: 'POST',
    body: JSON.stringify({
      name,
      contactEmail,
      paymentMethods: [paymentMethod],
      requireTaxDocument,
      sendEmail: true,
      organizationNameOnRequest: 'Manifund',
    }),
  })
}

export async function getRecipientInvite(inviteId: string) {
  return await mercuryFetch<RecipientInvite>(`/recipients/invites/${inviteId}`)
}

export type Recipient = {
  id: string
  name: string
  status: string
  address?: { country?: string | null } | null
  internationalWireRoutingInfo?: {
    address?: { country?: string | null } | null
    countrySpecific?: Record<string, unknown> | null
  } | null
}

export async function getRecipient(recipientId: string) {
  return await mercuryFetch<Recipient>(`/recipient/${recipientId}`)
}

// Wires to these countries need a regulatory purpose code (India's P1302,
// the Philippines' BSP code) that request-send-money has nowhere to carry:
// purpose.simple is a fixed 14-value enum with no code field. So we let Mercury
// collect the bank details as usual and hand the payment itself to an admin.
const MANUAL_WIRE_COUNTRIES = ['IN', 'PH']
const MANUAL_WIRE_COUNTRY_KEYS = ['india', 'philippines']

export function isManualWireCountry(recipient: Recipient) {
  const countries = [
    recipient.address?.country,
    recipient.internationalWireRoutingInfo?.address?.country,
  ]
  if (countries.some((c) => c && MANUAL_WIRE_COUNTRIES.includes(c.toUpperCase()))) return true
  // Mercury only populates countrySpecific for countries needing extra data, so
  // the key itself is a reliable second signal if an address is missing.
  const specific = recipient.internationalWireRoutingInfo?.countrySpecific ?? {}
  return Object.keys(specific).some((k) => MANUAL_WIRE_COUNTRY_KEYS.includes(k.toLowerCase()))
}

// Mercury requires a purpose for both wire types. 'other' needs additionalInfo.
const WIRE_PURPOSE = {
  simple: { category: 'other', additionalInfo: 'Grant disbursement from Manifund' },
}

export async function requestSendMoney(props: {
  recipientId: string
  amount: number
  paymentMethod: PaymentMethod
  idempotencyKey: string
  withdrawalRequestId: string
}) {
  const { recipientId, amount, paymentMethod, idempotencyKey, withdrawalRequestId } = props
  return await mercuryFetch<SendMoneyRequest>(`/account/${grantsAccountId()}/request-send-money`, {
    method: 'POST',
    body: JSON.stringify({
      recipientId,
      amount,
      paymentMethod,
      idempotencyKey,
      purpose: WIRE_PURPOSE,
      // note is our machine key for matching the webhook back to a request;
      // externalMemo hits the recipient's bank statement, so keep it readable.
      note: `mfw:${withdrawalRequestId}`,
      externalMemo: 'Manifund grant',
    }),
  })
}

export async function listSendMoneyRequests() {
  const requests: SendMoneyRequest[] = []
  let startAfter: string | undefined
  // Page cap is a runaway guard, not a real bound: 20 pages is 20k requests.
  for (let i = 0; i < 20; i++) {
    const res = await mercuryFetch<{
      requests?: SendMoneyRequest[]
      page?: { nextPage?: string | null }
    }>(
      `/request-send-money?accountId=${grantsAccountId()}&limit=1000` +
        (startAfter ? `&start_after=${startAfter}` : '')
    )
    requests.push(...(res.requests ?? []))
    const next = res.page?.nextPage
    if (!next) break
    startAfter = next
  }
  return requests
}

export async function getTransaction(transactionId: string) {
  return await mercuryFetch<MercuryTransaction>(
    `/account/${grantsAccountId()}/transaction/${transactionId}`
  )
}

// Used to notice that an admin wired a manual payment from the dashboard.
export async function listSentTransactionsSince(since: string) {
  const start = since.slice(0, 10)
  const transactions: MercuryTransaction[] = []
  let offset = 0
  do {
    const res = await mercuryFetch<{ total?: number; transactions?: MercuryTransaction[] }>(
      `/account/${grantsAccountId()}/transactions?status=sent&start=${start}&limit=1000&offset=${offset}`
    )
    const page = res.transactions ?? []
    transactions.push(...page)
    offset += page.length
    if (page.length === 0 || offset >= (res.total ?? 0)) break
  } while (offset < 20000)
  return transactions
}
