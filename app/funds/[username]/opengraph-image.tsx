import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getFundByUsername } from '@/db/profile'
import { getFundAdmins } from '@/db/fund'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { FUND_PAGES } from '../fund-pages'
import { FundOgCard, imageDataUrl } from './fund-og-card'

export const revalidate = 3600
export const alt = 'Fund on Manifund'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const supabase = await createServerSupabaseClient()
  const fund = await getFundByUsername(supabase, username)
  if (!fund) {
    return new Response('Not found', { status: 404 })
  }
  const extras = FUND_PAGES[fund.username] ?? {}
  const [admins, causes, font, fox] = await Promise.all([
    getFundAdmins(supabase, fund.id),
    supabase.from('causes').select('open').eq('fund_id', fund.id).throwOnError(),
    readFile(join(process.cwd(), 'public/ReadexPro-Regular.ttf')),
    readFile(join(process.cwd(), 'public/SolidWhiteManifox.png')),
  ])
  const [cover, ...avatars] = await Promise.all([
    imageDataUrl(extras.cover ?? fund.avatar_url),
    ...admins.map((admin) => imageDataUrl(admin.avatar_url)),
  ])
  return new ImageResponse(
    <FundOgCard
      name={fund.full_name}
      mission={extras.mission ?? fund.bio}
      cover={cover}
      admins={admins.map((admin, i) => ({ name: admin.full_name, avatar: avatars[i] }))}
      facts={(extras.facts ?? []).slice(0, 2)}
      open={(causes.data ?? []).some((cause) => cause.open)}
      fox={`data:image/png;base64,${fox.toString('base64')}`}
    />,
    {
      ...size,
      fonts: [{ name: 'Readex Pro', data: font, style: 'normal', weight: 400 }],
    }
  )
}
