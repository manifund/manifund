import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileByUsername, getUser } from '@/db/profile'
import { getSelectProjects } from '@/db/project'
import Link from 'next/link'
import { ProfileTrust, ProjectEval, getAllEvals, getAllTrusts } from '@/db/eval'
import { ArrowLongRightIcon } from '@heroicons/react/20/solid'
import { ResultsTable } from './results-table'

export type Result = {
  evaluatorId: string
  insideScore: number
  confidence: number
  trustScores: Record<string, number>
  outsideScore: number
  overallScore: number
}

export default async function ResultsPage(props: { params: Promise<{ usernameSlug: string }> }) {
  const { usernameSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const evaluator = await getProfileByUsername(supabase, usernameSlug)
  if (!evaluator) {
    return <div>User not found</div>
  }
  const [user, evals, trusts] = await Promise.all([
    getUser(supabase),
    getAllEvals(supabase),
    getAllTrusts(supabase),
  ])
  const thisProfilesEvals = evals.filter((e) => e.evaluator_id === evaluator.id)
  const projects = await getSelectProjects(
    supabase,
    thisProfilesEvals.map((e) => e.project_id)
  )
  const resultsMap = Object.fromEntries(
    thisProfilesEvals.map((profilesEval) => {
      const thisProjectEvals = evals.filter((e) => e.project_id === profilesEval.project_id)
      const thisProjectTrusts = trusts.filter(
        (t) =>
          thisProjectEvals.find((e) => e.evaluator_id === t.trusted_id) &&
          thisProjectEvals.find((e) => e.evaluator_id === t.truster_id)
      )
      return [
        profilesEval.project_id,
        calculateResult(thisProjectEvals, thisProjectTrusts, profilesEval.evaluator_id),
      ]
    })
  )
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{evaluator.full_name}&apos;s evals</h1>
      {projects.length === 0 ? (
        <div className="mt-5 text-center text-sm italic text-gray-600">
          {evaluator.full_name} hasn&apos;t evaluated any projects yet.
        </div>
      ) : (
        <ResultsTable resultsMap={resultsMap} projects={projects} />
      )}
      <Link
        href={user ? '/evals-form' : '/login'}
        className="mt-10 flex items-center justify-end gap-1 text-sm font-semibold text-orange-600"
      >
        {user ? 'My evals form' : 'Log in to add my evals'}
        <ArrowLongRightIcon className="h-5 w-5 stroke-2" />
      </Link>
    </div>
  )
}

function calculateResult(evals: ProjectEval[], trusts: ProfileTrust[], evaluatorId: string) {
  const resultsArr = makeResultsArraySingleProject(evals, trusts)
  const thisProfileResult = resultsArr.find((i) => i.evaluatorId === evaluatorId)
  if (!thisProfileResult) {
    return null
  } else if (evals.length === 1) {
    thisProfileResult.outsideScore = NaN
    thisProfileResult.overallScore = thisProfileResult.insideScore
  } else {
    // Set initial overallScore and outsideScore non-self-referentially
    resultsArr.forEach((resultObj) => {
      const otherResults = resultsArr.filter((i) => i.evaluatorId !== resultObj.evaluatorId)
      resultObj.outsideScore =
        otherResults.reduce((acc, i) => acc + i.insideScore, 0) / otherResults.length
      resultObj.overallScore =
        resultObj.insideScore * resultObj.confidence +
        resultObj.outsideScore * (1 - resultObj.confidence)
    })
  }
  return thisProfileResult
}

function makeResultsArraySingleProject(evals: ProjectEval[], trusts: ProfileTrust[]) {
  const results = [] as Result[]
  evals.forEach((evalItem) => {
    const trustScores = makeTrustScoresSingleProject(evals, trusts, evalItem)
    results.push({
      evaluatorId: evalItem.evaluator_id,
      insideScore: evalItem.score,
      confidence: evalItem.confidence,
      trustScores,
      outsideScore: 0,
      overallScore: 0,
    })
  })
  return results
}

function makeTrustScoresSingleProject(
  evals: ProjectEval[],
  trusts: ProfileTrust[],
  currEval: ProjectEval
) {
  const currEvaluatorTrusts = trusts.filter((t) => t.truster_id === currEval.evaluator_id)
  const trustScores = Object.fromEntries(currEvaluatorTrusts.map((t) => [t.trusted_id, t.weight]))
  evals.forEach((evalItem) => {
    if (evalItem.evaluator_id === currEval.evaluator_id) {
      trustScores[evalItem.evaluator_id] = 0
    } else if (!trustScores[evalItem.evaluator_id]) {
      trustScores[evalItem.evaluator_id] = 1
    }
  })
  const total = Object.values(trustScores).reduce((acc, i) => acc + i, 0)
  return Object.fromEntries(
    Object.entries(trustScores).map(([key, value]) => [key, total === 0 ? value : value / total])
  )
}
