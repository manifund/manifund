// Post-filters transaction rows whose nested project is `hidden`/`draft` on the
// public tier, and strips the helper-only `stage` field so the wire response
// keeps the public (title, slug) shape callers expect. Project-less rows
// (deposits, withdrawals, user-to-user tips, profile donations) are always kept
// — using `!inner` instead would wrongly drop them. Mirrors the per-tool
// `!admin && stage in (hidden, draft)` gate every project-touching tool applies;
// `admin` is the public/admin security boundary (specs/MCP.md).
export function filterVisibleProjectTxns(txns: any[] | null | undefined, admin: boolean): any[] {
  const list = txns ?? []
  const visible = admin
    ? list
    : list.filter((t) => !t.project || !['hidden', 'draft'].includes(t.project.stage))
  return visible.map((t) =>
    t.project ? { ...t, project: { title: t.project.title, slug: t.project.slug } } : t
  )
}
