# Grant agreements and admin approvals

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

The contract every grant recipient signs before money moves, the Charity's countersignature (an admin's approval),
the private records kept around a signature (signing evidence, tax documents), and the admins' list of proposals
waiting for a verdict. How it used to work and how it changed: `history.md`.

**Status of this doc.** Written from the code on 2026-10-08, not yet read by the team. Every rule below is
**observed (code, 2026-10-08)**: what the product does today, not a decision. "What it's for" is a draft of the
intent, for the team to confirm. Suspected bugs are under "Open questions", not rules.

Neighbouring areas: activation, which waits for the signature (`../offers/README.md`, B9, B10); verdicts, which
are the approval this doc calls the countersignature (`../regrants/README.md`, G12-G16); the verdict's admin note
(`../../product/comments/README.md`, C27); closing proposals and their reminder emails (project lifecycle); emails sent around a
signature (notifications).

## What it's for (draft, to confirm)

- **A legal basis for every grant.** Manifund's grants are given by Manifold for Charity, a 501(c)(3). "All grant
  recipients are required to agree to the terms and conditions outlined here before receiving funds" (the agreement
  page): the money is used for the project's charitable purpose, no political campaigning, no lobbying unless the
  project declared it, reporting.
- **Public, like the rest of a grant.** The agreement page has been viewable by everyone since it was built (#38):
  anyone can read what a grantee agreed to, and who countersigned when.
- **Organizations and fiscal sponsors as recipients** (#196, 2026-08): the contracting party can be an organization;
  its authorized signatory, who often has no Manifund account (a fiscal sponsor's director), signs through an emailed
  link.
- **A signature that holds up**: the exact text signed, who signed, when, from where, and how they were
  authenticated, kept so a past signer's agreement can't silently change (`docs/plans/org-grant-agreements-plan.md`,
  "ESIGN / UETA").
- **Tax diligence**: staff record which tax documents they hold for a grant (W-9, W-8, determination letter); the
  documents themselves arrive by email.
- **One place for admins to give verdicts**: proposals that have reached their minimum and wait for approval.

## How it's built

- **On the project**: `projects.signed_agreement` (the flag activation, the project page and lists read) and
  `projects.approved` (the verdict: null undecided, true approved, false rejected). Only the server sets them (and the
  project's `type` and `creator`): a database trigger, `protect_project_approval_columns`, keeps them as they were
  when anyone else updates a project, and a project a person creates starts unapproved and unsigned (#308,
  2026-10-16; tests: `tests/db/project-approval.test.ts`).
- **`grant_agreements`**: one row per project, created when the agreement is signed or sent for signature. What the
  page shows: the snapshot at signing (recipient name, project title and description, lobbying choice, version),
  the organization's details, `rendered_document` (the HTML as signed), `signed_at`, `approved_at` / `approved_by`
  (the countersignature) and `signed_off_site` (set by hand). Browsers can't write it.
- **`grant_agreement_private`**: the signatory's email, the signing link's state (hash of the token, sent to, sent
  at, expires at), the signer's IP address and browser, and the tax flags. Row-level security with no policies:
  only the server's service role reads or writes it.
- **Routes** (Edge, `pages/api/`), all writing with the service role:
  - `sign-grant-agreement`: the creator signs, as an individual or for an organization;
  - `send-agreement-for-signature`: the creator sends a signing link to the organization's signatory;
  - `sign-grant-agreement-external`: the signatory signs with the link (no account);
  - `update-agreement-tax-flags`: admins record tax documents.
  The two signing routes share `commitSignature` (`utils/grant-agreement-write.ts`), so the order can't drift:
  agreement row, then `projects.signed_agreement`, then the private row, then the activation check
  (`maybeActivateProject`).
- **Documents**: `app/projects/[slug]/agreement/grant-agreement.tsx` (individual, versions 1-3) and
  `org-grant-agreement.tsx` (organization, version 1); `utils/constants.ts` holds the current versions.
  `utils/render-agreement.tsx` renders the same components to HTML for the stored document and the emailed copy.
  Organization details are checked by one function, `parseOrgValues` (`db/grant_agreement.ts`), in the form and on
  the server.
- **Signing links** (`utils/signing-token.ts`): 32 random bytes, base64url; only the SHA-256 is stored; valid 30
  days.
- **Pages**: `/projects/<slug>/agreement` (the agreement and the signing flow, `agreement-flow.tsx`; the admins' tax
  panel), `/agreement/sign/<token>` (the signatory's page), `/admin/approvals`. On the project page, the "Funding
  requirements" strip (`proposal-requirements.tsx`) or the creator's "Next steps" (`project-timeline.tsx`); on
  profiles, each project's next step (`profile-projects.tsx`).
- **Reminders**: the close-grants cron (project lifecycle) emails the creator of a funded proposal to sign, and, once
  signed, the admins to approve; an admin can pause a project's reminders from `/admin/approvals`
  (`projects.alerts_paused`, #219).

## Rules

Observed (code, 2026-10-08). Ids are stable once merged.

### The agreement page and document

- **A1** Every project has an agreement page, `/projects/<slug>/agreement`, which anyone can view, signed in or not.
  It shows the document, the recipient's signature block, the Charity's signature block, and the public benefit
  chosen at approval ("This grant benefits the public by funding: …"). A rejected project's page shows "404"
  instead, and so does a hidden or draft project's page, except to its creator and admins (#309).
- **A2** There are two documents: the individual agreement (current version 3), whose recipient is the creator under
  their full name, and the organization agreement (current version 1), which names the organization with its
  address, country, kind of entity and EIN. A signed individual agreement keeps the version it was signed under
  (older ones show their own wording and clause numbers).
- **A3** When the project declares lobbying, the clause forbidding attempts to influence legislation is left out of
  the document. A signed agreement keeps the choice made at signing, whatever the project says later.
- **A4** A signed individual agreement shows what was recorded at signing (the recipient's name and the project's
  title); an unsigned one shows the project's current values.
- **A5** While the project has no verdict, the document includes a clause saying the Charity hasn't decided yet and
  will review the grant after signing (see Open questions on signed agreements).
- **A6** Signing stores the document as rendered at that moment (`rendered_document`), and the signer is emailed a
  copy with their attestation sentence.

### The creator signs

- **A7** Only the project's creator signs on the agreement page; other people see the document read-only, and the
  server refuses them.
- **A8** The creator says who receives the grant: themselves (an individual), or an organization, including a fiscal
  sponsor receiving funds on the project's behalf. As an individual, they tick "I, <name>, agree to the terms …" and
  submit.
- **A9** An organization's details are required, and checked by the server as well as the form: legal name,
  registered address, country, kind of entity (US 501(c)(3), other US nonprofit, US for-profit, non-US
  organization), an EIN for a US entity (for a non-US one, an EIN or a confirmation that it has no US taxpayer ID),
  and the signatory's name. Text is trimmed; a missing detail is refused (400) with a message naming it.
- **A10** A creator signing for an organization must attest their authority ("I, <name>, am authorized to enter
  into this agreement on behalf of <organization> …"); without it the server refuses (400).
- **A11** An agreement is signed once. After signing, the page shows no form, and signing again or sending it for
  signature is refused (409, "This agreement has already been signed.").
- **A12** Signing as an individual clears organization details left from a draft (address, country, kind of
  entity, EIN, attestation), so the agreement doesn't claim an organization that isn't party to it.
- **A13** A signature records, privately: the signer's email, IP address and browser, besides the public time of
  signing. When the creator signs, their account's email is the signer's email, and any signing link sent earlier
  stops working.
- **A14** The project is marked signed only after its agreement is saved; then the activation check runs (B10), so
  a project already approved and at its minimum activates on signing.

### Someone else signs: the signing link

- **A15** When someone else must sign for the organization, the creator enters that person's email (refused without
  an "@", 400) and sends a signing link. The details are saved as an unsigned agreement, the signatory is emailed a
  link valid for 30 days, and the project waits for their signature. The page says "AWAITING SIGNATORY" and shows
  the creator and admins whom the link went to, and when.
- **A16** The link is the only credential: the signatory needs no account, and being signed in gives no more
  rights. Only a hash of the link's token is stored.
- **A17** Sending again (a resend, or to someone else) makes a new link, and the old one stops working.
- **A18** An unknown, expired or already used link shows "This signing link isn't valid" on its page, and the
  signing route refuses it with one message (404), so an answer never tells whether a link existed.
- **A19** The signatory sees the document with the details the creator entered, can correct them (the checks of
  A9), must attest their authority (400 otherwise), and signs. The link is then used up. The agreement records the
  signer's IP address and browser, and keeps as signer's email the address the link was sent to. The signatory is
  emailed a copy and the creator is told who signed.

### Who sees what

- **A20** Nobody writes an agreement from a browser; every write goes through the server.
- **A21** Signing evidence and tax records (the signer's email, the link's state, IP address, browser, tax flags)
  live in a separate private table that browsers can neither read nor write. The page shows the signer's email and
  the link's recipient only to the creator and admins.

### The Charity's countersignature

- **A22** The countersignature is the admin's approval: approving a project (G13) records the approving admin and
  the date on that project's agreement, and only that one; the page shows them as the "Charity signatory". The
  page's tag reads "AWAITING SIGNATURE", "AWAITING SIGNATORY" (a link is out), "AWAITING COUNTER SIGNATURE" (signed,
  not yet approved) or "COMPLETE" (signed and approved).
- **A23** An agreement marked as signed off-site (by hand, for a modified agreement or a grantee's anonymity) shows a
  note saying so instead of the document and the signing flow.

### Tax records

- **A24** On an organization's agreement, admins see a panel with the signer's email and four records: W-9 received,
  W-8 received, 501(c)(3) determination letter on file, subject to foreign withholding. Only admins can save it
  (403 otherwise; 400 without a project). A received form keeps the date it was first ticked: saving again keeps
  that date, unticking clears it.

### What's missing, where people look

- **A25** On a grant proposal's page, a strip shows the three requirements (sign the agreement, with a link to it;
  reach the minimum funding; Manifund's approval), each ticked when done. The creator of a grant in draft, proposal
  or active sees a "Next steps" timeline instead, with the same steps plus publishing and withdrawing. Neither shows
  while a project transfer is pending.
- **A26** On a profile's list of projects, a grant proposal shows its next step: "unfunded" below its minimum, then
  "pending grant agreement signature" (a link to the agreement) until signed, then "pending admin approval".

### Admin approvals

- **A27** `/admin/approvals` is for admins only: anyone else gets the "not found" page, before any data is read
  (the status is 200, as the page has started streaming).
- **A28** It lists proposals without a verdict whose pending donation and assurance-buy offers reach the minimum
  funding, newest first: the creator, the project (in red while its agreement is unsigned), a button pausing the
  project's reminders (dimmed while paused), and the verdict button (G12-G14; the verdict window warns when the
  project involves lobbying).

## Decisions

From the code's history; the "why" comes from the PRs and code comments. Newest first.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-14 | Caroline (#309) | Hidden and draft projects' agreement pages show "404", except to their creator and admins (A1) | Not given |
| 2026-10-01 | Caroline (#277) | The approvals list counts only pending offers toward the minimum (A28) | Withdrawn offers listed projects that hadn't reached it |
| 2026-09-30 | Vals (#274) | Admin pages check the admin themselves, not only in the layout (A27) | Each page decides on its own what it shows |
| 2026-09-01 | Caroline (#219) | Approval reminders only once the creator has signed; a per-project pause on the approvals list (A28) | Nothing for an admin to act on before the signature; stalled proposals kept reminding |
| 2026-08-17 | Caroline (#200) | An organization's signature mark and date appear only once signed | An agreement waiting for its signatory looked executed |
| 2026-07-25, shipped 2026-08-17 | Austin (#196, plan in `docs/plans/org-grant-agreements-plan.md`) | Organizations as recipients, with a separate document; a third-party signatory signs through an emailed link; the stored rendered document is the record; signing evidence and tax flags in a private table; only the server writes agreements (A2, A9-A21, A24) | Fiscal sponsors must be the contracting party and sign themselves; a signature should be reconstructable |
| 2026-06-02 | Austin | An approval stamps only its own project's agreement (A22) | A bug had restamped every agreement with the latest approval |
| 2024-05-11 | Austin | The public benefit chosen at approval shows under the agreement (A1) | Not recorded |
| 2024-03-26 | Rachel (#121) | A `grant_agreements` row records the signature time, the approver, the version signed and whether it was signed off-site (A2, A4, A22, A23) | The page should show the agreement actually signed, not only one reconstructable from notes |
| 2024-02-16 | Rachel (#81) | The signer gets the agreement by email after signing (A6) | A copy for their records |
| 2024-02-09 | Rachel | The no-lobbying clause is left out for projects that declare lobbying (A3) | Not recorded |
| 2023-06-02 | Rachel (#38) | Every project has a public agreement page; only its creator agrees; a progress strip shows what blocks a proposal (A1, A7, A25, A26) | Fiscal sponsorship: recipients agree to the terms before receiving funds |

## Open questions

Found while writing this doc (2026-10-08); none decided.

Suspected bugs (not rules):

1. **An approval given before the agreement is signed is never recorded on it.** The verdict function updates the
   agreement row only if one exists (`execute_grant_verdict_v2`, `supabase/migrations/20260930235920_comments_everywhere.sql`,
   "update grant_agreements … set approved_at"), and the row is only created at signing or sending
   (`commitSignature`, `utils/grant-agreement-write.ts`), which doesn't copy the approval. The page then says
   "COMPLETE" with an empty Charity signature line. Should the approval be recorded either way?
2. **The page re-renders a signed agreement instead of showing the stored one.** The clause of A5 follows the
   project's current verdict, so an agreement signed before approval loses it on the page once approved; the
   organization document uses the project's current title and creation date where the individual one uses the
   recorded title. The stored `rendered_document` stays right, but nothing in the app shows it. Should the page show
   the stored document when there is one?

For the team:

3. **The approvals list includes certificate proposals**, which activate without approval (B18), and doesn't count
   the market maker's share in their minimum. Certificates are dormant, so it may not matter.
4. **Tax records**: the tax panel (A24) and Mercury's own tax-document collection (`MERCURY_REQUIRE_TAX_DOCUMENT`,
   off) are both available. Who records tax documents today, and where?
5. **An organization named as recipient doesn't change where money goes**: withdrawals still pay the creator's
   account (the plan's own "Open" item). Worth deciding before fiscal sponsors are common.
6. **Small answers**: a non-creator's signature, or a request for a project that doesn't exist, gets a 500
   (`Response.error()`) rather than a 403 or 404; the rejected project's agreement page shows "404" as text with a
   200 (checked locally, 2026-10-08).
7. **Older agreements**: about 110 grant projects created 2023-04 to 2024-03 are marked signed without a recorded
   signing time (before #121), and 840 signed agreements belong to proposals that never got a verdict (open,
   closed unfunded or hidden). Nothing to fix, but worth knowing when reading the data (production copy of
   2026-10-07).

## Later

- Nothing planned yet.

## Tests

Run locally: see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic and documents** (`tests/ai-reference/unit/agreements.test.ts`,
  `tests/ai-reference/components/agreements.test.tsx`): A2-A6
  (the documents, their versions, the lobbying clause, the snapshot, the emailed copy), A9 (organization details),
  A13 and A19 (the signer's IP address), A15, A16, A18 (signing links: token, hash, expiry, lookup).
- **Database** (`tests/ai-reference/db/agreements.test.ts`): A2 and A9 (the tables' own checks), A16 (one agreement
  per token hash), A20, A21 (who can write the two tables, who can read the private one), A22 (the countersignature
  on its own agreement only).
