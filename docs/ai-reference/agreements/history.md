# Grant agreements: history

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How agreements changed, for reading old rows and old documents. The current rules are in `README.md`.

## Document versions

| Version | Signed (production copy, 2026-10-07) | What changed |
|---|---|---|
| Individual 1 | 2023-07 to 2024-01 | The first agreement (#38, 2023-06); an extra section, so later clause numbers are one higher |
| Individual 2 | 2023-09 to 2024-03 | A section removed and 5(c) edited (2023-08) |
| Individual 3 | since 2024-02 | "your grant" became "this grant"; the no-lobbying clause can be left out (2024-02) |
| Organization 1 | since 2026-08-18 | A separate document for organizations and fiscal sponsors (#196) |

Version numbers were recorded from #121 (2024-03); earlier rows were filled in afterwards. The document as signed is
stored (`rendered_document`) only since 2026-08-18; older agreements are re-rendered from their recorded fields and
version.

## Signatures and approvals

- **2023-06 to 2024-03**: signing set only `projects.signed_agreement`; there was no record of when, or of the
  version. `grant_agreements` came with #121 (2024-03-26).
- **Until 2026-06-02**: every approval restamped the approval date and approver on every agreement (a bug in
  `execute_grant_verdict`). The real dates were lost; a one-off repair (`scripts/backfill-approved-at.ts`) set each
  approved agreement's approval date to its signing date and cleared the rest. Approval dates before 2026-06 are
  therefore approximate.
- **Since #196 (2026-08-17)**: only the server writes agreements (before, the signing route wrote with the
  creator's own client).
- **Before #196**: organizations signing for a project signed off-site (`signed_off_site`, set by hand); the page's
  note said so. The flag now remains for modified agreements and anonymity.
