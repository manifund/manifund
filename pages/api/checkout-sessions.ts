import Stripe from 'stripe'
import { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/db/database.types'
import { isProd, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/db/env'
import { CENTS_PER_DOLLAR } from '@/utils/constants'
import { stripe } from '@/utils/stripe'

export type StripeSession = Stripe.Event.Data.Object & {
  id: string
  url: string
  metadata: {
    userId: string
    dollarQuantity: string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }
  // Node-runtime equivalent of getUserAndClient: the deposit is always
  // credited to the signed-in caller, never to a body-supplied user id.
  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? '' }))
      },
      setAll() {},
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { dollarQuantity, passFundsToId } = (await req.body) as {
    dollarQuantity: number
    passFundsToId?: string
  }
  if (!Number.isFinite(dollarQuantity) || dollarQuantity <= 0 || dollarQuantity > 1_000_000) {
    return res.status(400).json({ error: 'Invalid amount' })
  }
  const amountToCharge = Math.round(dollarQuantity * CENTS_PER_DOLLAR)
  try {
    const session = await stripe.checkout.sessions.create({
      metadata: {
        userId: user.id,
        dollarQuantity,
        passFundsToId: passFundsToId ?? null,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountToCharge,
            product: isProd() ? 'prod_NqCUvVOuGcx6jo' : 'prod_NqCWEno6lHiydK',
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: isProd() ? 'https://manifund.org' : 'http://localhost:3000',
      cancel_url: isProd() ? 'https://manifund.org' : 'http://localhost:3000',
    })
    res.json({ url: session.url, id: session.id })
  } catch (error: any) {
    console.log(error)
    res.status(error.statusCode || 500).json(error.message)
  }
}
