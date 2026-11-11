// Creates a fund (F7): its profile, its admins, and the cause its applications are tagged with.
// Safe to re-run: an existing fund or cause with the same username/slug is updated, admins are only added.
//   bun scripts/create-fund.ts --username my-fund --name "My Fund" --bio "One line" --admins Austin,carol
//   add --open to take applications (the cause shows on the create form), --dry-run to print what it would write
import { createAdminClient } from '@/db/supabase-admin'

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function main() {
  const username = arg('username')
  const name = arg('name')
  const bio = arg('bio') ?? ''
  const adminUsernames = (arg('admins') ?? '').split(',').filter(Boolean)
  if (!username || !name || adminUsernames.length === 0) {
    throw new Error('Needs --username, --name and --admins')
  }
  const supabase = createAdminClient()
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', adminUsernames)
    .throwOnError()
  const missing = adminUsernames.filter((u) => !admins?.some((a) => a.username === u))
  if (missing.length) {
    throw new Error(`No profile for ${missing.join(', ')}`)
  }
  const cause = {
    slug: username,
    title: name,
    open: process.argv.includes('--open'),
    prize: true,
    header_image_url: '',
  }
  if (process.argv.includes('--dry-run')) {
    console.log({ fund: { username, full_name: name, bio, type: 'fund' }, admins, cause })
    return
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, type')
    .eq('username', username)
    .maybeSingle()
    .throwOnError()
  if (existing && existing.type !== 'fund') {
    throw new Error(`@${username} is already a ${existing.type} profile`)
  }
  const { data: fund } = await supabase
    .from('profiles')
    .upsert(
      { ...(existing ? { id: existing.id } : {}), username, full_name: name, bio, type: 'fund' },
      { onConflict: 'username' }
    )
    .select('id')
    .single()
    .throwOnError()
  await supabase
    .from('fund_admins')
    .upsert(
      admins!.map((a) => ({ fund_id: fund.id, profile_id: a.id })),
      { onConflict: 'fund_id,profile_id', ignoreDuplicates: true }
    )
    .throwOnError()
  await supabase
    .from('causes')
    .upsert({ ...cause, fund_id: fund.id }, { onConflict: 'slug' })
    .throwOnError()
  console.log(
    `ok: /${username} (${fund.id}), admins ${adminUsernames.join(', ')}, cause ${username}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
