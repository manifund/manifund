import Link from 'next/link'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/db/supabase-admin'
import { ProfileKarmaBreakdown, ProjectKarmaBreakdown } from '@/utils/karma'
import { RecomputeKarmaButton } from './recompute-button'

export const dynamic = 'force-dynamic'

const fmt = (n: number | null | undefined) => (n == null ? '' : Math.round(n).toLocaleString())
const cell = 'whitespace-nowrap px-2 py-1 text-right'

export default async function AdminKarmaPage() {
  await requireAdmin()
  const supabase = createAdminClient()
  const [{ data: profiles }, { data: projects }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, full_name, karma, karma_breakdown, karma_updated_at')
      .order('karma', { ascending: false })
      .limit(100)
      .throwOnError(),
    supabase
      .from('projects')
      .select('id, title, slug, stage, karma, karma_breakdown, karma_updated_at')
      .order('karma', { ascending: false })
      .limit(100)
      .throwOnError(),
  ])
  const updatedAt = profiles?.[0]?.karma_updated_at

  return (
    <div className="flex flex-col gap-8 text-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Karma</h2>
        <span className="text-gray-500">
          Last computed: {updatedAt ? new Date(updatedAt).toLocaleString() : 'never'}
        </span>
        <RecomputeKarmaButton />
        <Link href="/about/karma" className="text-orange-600 hover:underline">
          How it&apos;s calculated
        </Link>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">Top 100 people</h3>
        <table className="bg-white">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              <th className="px-2 py-1 text-left">Person</th>
              <th className={cell}>Karma</th>
              <th className={cell}>Given</th>
              <th className={cell}>Received</th>
              <th className={cell}>Votes</th>
              <th className={cell}>Reacts</th>
              <th className={cell}># proj. donated</th>
              <th className={cell}># votes</th>
              <th className={cell}># reacts</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p, i) => {
              const b = p.karma_breakdown as ProfileKarmaBreakdown | null
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">
                    <Link href={`/${p.username}`} className="hover:underline">
                      {p.full_name} <span className="text-gray-400">@{p.username}</span>
                    </Link>
                  </td>
                  <td className={cell + ' font-semibold'}>{fmt(p.karma)}</td>
                  <td className={cell}>{fmt(b?.donationsGiven)}</td>
                  <td className={cell}>{fmt(b?.donationsReceived)}</td>
                  <td className={cell}>{fmt(b?.votes)}</td>
                  <td className={cell}>{fmt(b?.reacts)}</td>
                  <td className={cell}>{b?.projectsDonatedTo}</td>
                  <td className={cell}>{b?.voteCount}</td>
                  <td className={cell}>{b?.reactCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Top 100 projects</h3>
        <table className="bg-white">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              <th className="px-2 py-1 text-left">Project</th>
              <th className="px-2 py-1 text-left">Stage</th>
              <th className={cell}>Karma</th>
              <th className={cell}>Votes</th>
              <th className={cell}>Comments</th>
              <th className={cell}>Donations</th>
              <th className={cell}>Creator prior</th>
              <th className={cell}>Donors</th>
              <th className="px-2 py-1 text-left">Accepting $</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p, i) => {
              const b = p.karma_breakdown as ProjectKarmaBreakdown | null
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">
                    <Link href={`/projects/${p.slug}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-2 py-1">{p.stage}</td>
                  <td className={cell + ' font-semibold'}>{fmt(p.karma)}</td>
                  <td className={cell}>{fmt(b?.votes)}</td>
                  <td className={cell}>{fmt(b?.comments)}</td>
                  <td className={cell}>{fmt(b?.donations)}</td>
                  <td className={cell}>{fmt(b?.creator)}</td>
                  <td className={cell}>{b?.donorCount}</td>
                  <td className="px-2 py-1">{b ? (b.acceptingDonations ? 'yes' : 'no') : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
