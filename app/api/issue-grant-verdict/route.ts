import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { createAdminClient } from '@/db/supabase-admin'
import { getProfileById, isAdmin } from '@/db/profile'
import { getProjectById } from '@/db/project'
import { getURL } from '@/utils/constants'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { maybeActivateProject } from '@/utils/activate-project'
import { post } from '@/lib/comments'
import { log } from '@/lib/log'

// Moved from pages/api (Edge) to App Router (Node) in the comments POC: the admin's note is posted
// through lib/comments ('admin note') after the verdict, instead of inside the SQL function.
export const runtime = 'nodejs'

type VerdictProps = {
  approved: boolean
  projectId: string
  adminComment: JSONContent | null
  publicBenefit: string
}

export async function POST(req: Request) {
  const { approved, projectId, adminComment, publicBenefit } = (await req.json()) as VerdictProps
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Only admins can issue grant verdicts.' }, { status: 403 })
  }
  const adminProfile = await getProfileById(supabase, user.id)
  const adminName = adminProfile?.full_name?.split(' ')[0]
  if (!adminProfile || !adminName) {
    return NextResponse.json(
      { error: `No profile name found for admin ${user.email}.` },
      { status: 500 }
    )
  }
  const project = await getProjectById(supabase, projectId)
  const creator = await getProfileById(supabase, project?.creator)
  if (!project || !creator) {
    return NextResponse.json({ error: 'Project or project creator not found.' }, { status: 404 })
  }

  const { error } = await createAdminClient().rpc('execute_grant_verdict_v2', {
    approved,
    project_id: projectId,
    admin_id: user.id,
    public_benefit: publicBenefit,
  })
  if (error) {
    log.error('grant.verdict_failed', { project_id: projectId, error })
    return NextResponse.json(
      { error: `Failed to execute grant verdict: ${error.message}` },
      { status: 500 }
    )
  }

  // The verdict is saved by now. A note that can't be posted is logged and reported to the admin
  // (money review 2026-09-30, the user's answer), who can post it as a comment instead.
  let noteError: string | undefined
  if (adminComment) {
    const note = await post(
      adminProfile,
      { target: { project: projectId }, content: adminComment, type: 'admin note' },
      'server'
    )
    if (!note.ok) {
      log.error('grant.admin_note_failed', {
        project_id: projectId,
        status: note.status,
        error: note.message,
      })
      noteError = `The verdict was saved, but the note wasn't posted (${note.message}). Please post it as a comment on the project.`
    }
  }

  const recipientSubject = approved
    ? 'Manifund has approved your project!'
    : 'Manifund has declined your project.'
  const recipientMessage = approved
    ? `We've approved your project, "${project.title}"! Once you've reached your minimum funding goals and signed your grant agreement, you'll be able to withdraw your funds via your profile page.`
    : `We regret to inform you that we've decided not to approve your project, "${project.title}." We've left a comment on your project with a short explanation as to why. Please let us know on our discord or by replying to that comments if you have any questions or feedback about the process.`
  await sendTemplateEmail(
    TEMPLATE_IDS.VERDICT,
    {
      recipientFullName: creator.full_name,
      verdictMessage: recipientMessage,
      projectUrl: `${getURL()}/projects/${project.slug}`,
      subject: recipientSubject,
      adminName,
    },
    creator.id
  )
  await maybeActivateProject(supabase, projectId)
  return NextResponse.json({ ok: true, noteError })
}
