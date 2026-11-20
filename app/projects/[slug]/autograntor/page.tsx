import { notFound } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'
import { getProjectBySlug } from '@/db/project'
import { AutograntorEval, getAutograntorEvals } from '@/db/autograntor'
import { formatDateUtc } from '@/utils/formatting'

export const revalidate = 0

const points = (n: number) => Math.round(n).toLocaleString('en-US')
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const date = (d: string) => formatDateUtc(d, { month: 'short', day: 'numeric', year: 'numeric' })

// Public (P21), except for hidden and draft projects, which only their owner and admins can see.
export default async function AutograntorPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createServerSupabaseClient()
  const [user, project] = await Promise.all([getUser(supabase), getProjectBySlug(supabase, slug)])
  if (!project) notFound()
  const isPrivate = project.stage === 'hidden' || project.stage === 'draft'
  if (isPrivate && user?.id !== project.creator && !isAdmin(user)) notFound()
  const evals = await getAutograntorEvals(supabase, project.id)
  const [latest, ...earlier] = evals

  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <Link href={`/projects/${slug}`} className="text-sm text-gray-500 hover:underline">
          ← {project.title}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Autograntor report</h1>
        <p className="text-sm text-gray-500">
          Expected utility of funding this project, in milestone points (a Plan A US–China pause =
          1,000,000), estimated by Claude as part of an experimental rating system.
        </p>
      </div>
      {latest ? <Run evaluation={latest} /> : <p className="text-sm">No autograntor runs yet.</p>}
      {earlier.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Earlier runs</h2>
          {earlier.map((e) => (
            <details key={e.id} className="rounded border border-gray-200 px-3 py-2">
              <summary className="cursor-pointer text-sm">
                {date(e.created_at)} · {e.prompt_version} · {e.milestones_version}
              </summary>
              <Run evaluation={e} />
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

function Run(props: { evaluation: AutograntorEval }) {
  const { evaluation } = props
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              {['Grant', 'Mean', 'Median', 'p10', 'p90', 'Per $1M', 'P(negative)', 'Post-2030'].map(
                (h) => (
                  <th key={h} className="pr-5 font-medium">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {evaluation.results.map((r) => (
              <tr key={r.amount}>
                <td className="pr-5">{usd(r.amount)}</td>
                <td className="pr-5 font-semibold">{points(r.mean)}</td>
                <td className="pr-5">{points(r.median)}</td>
                <td className="pr-5">{points(r.p10)}</td>
                <td className="pr-5">{points(r.p90)}</td>
                <td className="pr-5">{points((r.mean / r.amount) * 1e6)}</td>
                <td className="pr-5">{Math.round(r.p_negative * 100)}%</td>
                <td className="pr-5">{Math.round(r.post2030_share * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {date(evaluation.created_at)} · prompt {evaluation.prompt_version} ·{' '}
        {evaluation.milestones_version} · {evaluation.models}
      </p>
      <div
        className="prose prose-sm max-w-none overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: marked.parse(evaluation.report_md, { async: false }) }}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500">Ledger CSV</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre text-xs">{evaluation.ledger_csv}</pre>
      </details>
    </div>
  )
}
