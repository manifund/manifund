# What Manifund offers, and why

Manifund (manifund.org) is a charitable funding platform for AI safety, effective altruism, forecasting, animal
welfare, global health and science. People post what they want to do and what it would cost; donors and regrantors
fund them; the whole thing happens in public. Manifund is a 501(c)(3) public charity, formally Manifold for Charity.

This doc covers the offerings at the level of "what and why". Each area's own doc (`<area>/README.md`) has the
rules. The overview of the code and services is in `../README.md`.

## Principles behind the product

- **Public by default.** Who gave what to whom, the reasoning behind grants and the discussion around projects are
  visible to everyone. It builds trust, lets people learn whose taste to follow, and makes gaming visible.
- **A public ask gets a project funded more easily.** Posting on Manifund gives a project a place to explain itself,
  a record, and some legitimacy; donors can see who else backs it.
- **Judgment is spread out.** Regrantors with budgets, donors, commenters and evaluators all weigh in; money follows
  judgment that is visible and attributable.
- **Accountability after funding.** Funded projects post progress updates and a final report, publicly.
- **Neutral, with focus.** Anyone can post, but Manifund puts its energy where it knows the field (notably AI
  safety and EA).

## Offerings

### Grant requests (called "projects" on the site)

- A creator describes the work, a minimum amount (below which it can't go ahead) and a goal, a deadline, and the
  causes it belongs to. Drafts are private until published.
- A project moves through stages: draft → proposal → active → complete, or not funded (deadline passed below the
  minimum) or hidden (by an admin).
- A proposal becomes active when offers reach its minimum, an admin has approved it, and the grant agreement is
  signed. The offers then become donations the creator can withdraw.
- **Why:** a clear, public ask with a threshold lets many donors commit without risking money on a project that
  never gets enough to start.

### Giving

- Donors deposit money (card, via Stripe) into a **charity balance**: money that can only be given away. What a
  grantee receives lands in a **cash balance**, which they can withdraw (Stripe for instant US payouts, or bank
  transfers that a person approves).
- On a proposal, a donation is an **offer** that turns into money only if the project activates; on an active
  project, it transfers right away. Donors can also give to a regrantor's budget.
- Balances are computed from the ledger of every transaction, never stored, so the history explains every number.
- Manifund usually asks donors to cover a 5% fee for operations and fiscal sponsorship.
- **Why:** separating charity and cash money keeps donated money for charitable use (once deposited, it can only be
  given), and the ledger makes every balance auditable.

### Regranting

- **Regrantors** are people with a budget (from Manifund's funders or from donors who pick them) who make grants
  in their field. A regrantor can fund an existing proposal or create a grant for someone directly, including someone
  not yet on Manifund (they claim it when they sign up).
- A regrant comes with the regrantor's **rationale**, published as a comment the grantee can't edit.
- Large donors can nominate regrantors who share their values.
- **Why:** people close to a field spot good work early and can move fast; public rationales build each regrantor's
  track record, so donors can learn whose taste to trust. `/about/regranting-data` shows where regrantors give.

### Programs and causes

- **Causes** group projects by topic (e.g. science and technology). Some causes are **programs**: funding rounds
  with their own rules and deadlines, and funds (e.g. Falcon Fund, ACX Grants) with a pot of money and people
  deciding on it.
- **Why:** programs let a funder run a round on Manifund with the same public process; topics help discovery.

### People

- Every person has a profile: who they are, what they posted, gave and granted, what they wrote. Regrantors show
  their budget. `/people` lists everyone.
- **Why:** a person's public record (projects delivered, grants given and how they went, what they said) is what
  others use to decide whether to fund them or follow their lead.

### Discussion

- **Comments** on projects, on people's profiles and on programs: questions, answers, reasoning, appraisals. Edits
  keep every version visible; moderators can remove a comment with a public reason. Details: `comments/`.
- **Progress updates and final reports** are comments by the project's creator; creators of active projects get a
  reminder when they haven't posted an update in six months.
- **Reactions**, including tips (small amounts of charity money to the commenter, as thanks).
- **Following** a project (automatic when you give, vote or comment) brings its news; **notifications** gather
  what's relevant to you, in the app and by email.
- **Why:** the discussion is where judgment happens in the open: why someone funded a project, what worries others,
  how it went.

### Evaluation and quality

- Admins approve proposals before they can activate.
- Every new or edited project gets an automatic spam check, an AI quality score (a short rubric: concrete plan,
  budget clarity, track record, falsifiability, grandiose claims) and an AI-text check. The score is shown, not
  used to hide projects.
- Votes on projects; an experimental form for rating past grants' impact.
- **Why:** with many submissions, donors need signals beyond the pitch; automatic checks catch spam, people judge
  the rest.

### Discovery

- The home page lists projects (sorted by a "hot" score mixing votes, comments, money raised and recency) and a feed of recent
  comments and donations; cause pages; similar projects; a weekly digest email of what happened.
- An AI safety funder bulletin, and a donor survey that helps match donors with where to give.
- **Why:** most people find what to fund by browsing and being convinced, not by searching.

### Open data and agents

- A public API (`/api/v0`: projects, users, comments) and an MCP server (`/api/mcp`) so anyone, and their agents,
  can search projects, read discussions and get recommendations. Reference at `/docs` on the site.
- **Why:** public data is part of being public; agents are becoming how many people will explore where to give.

### Paperwork

- A grant agreement for each funded project, made out to a person or an organization (fiscal sponsors included),
  signed on the site before money moves.

### Older features, kept

- **Impact certificates:** projects funded by selling shares of their future impact, traded between users, with
  an automated market maker. No longer promoted; existing certificate projects still show.
