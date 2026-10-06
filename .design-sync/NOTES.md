# design-sync notes

Target: Claude Design project "Manifund" (`projectId` in config.json).

## How this repo is set up for syncing

- Manifund is an app, not a component library, so `.design-sync/` acts as the package root: `package.json` (name + `types`), `entry.tsx` (the barrel of synced components), and `build.mjs`.
- Run `node .design-sync/build.mjs` before the converter. It compiles the Tailwind stylesheet to `build/manifund.css` and emits a `.d.ts` tree to `build/types/` (tsc, then `@/` aliases rewritten to relative paths). `build/` is gitignored.
- Converter command: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle` (entry comes from `cfg.entry`).
- `tsconfig.json` here maps `next/link`, `next/image` and `next/navigation` to the stand-ins in `shims/`, and `@/*` to the repo root.
- `tailwind.config.js` here extends the app's config, adds `previews/` as a content source, and safelists the `w-N`/`h-N` sizes `Avatar` builds dynamically.
- `styles.css` loads Readex Pro, Josefin Slab and Satisfy from Google Fonts and sets the `--font-*` variables that `next/font` sets in the app. The user approved loading them this way at the plan step.
- Groups in the component picker come from the `category` frontmatter in `docs/<Name>.md` stubs.
- `guidelinesGlob` is `[]` on purpose: with the repo root as package dir the converter picked up the internal `docs/` folder (plans, postmortems) as design guidelines. Never point `docsDir`/`guidelinesGlob` at the repo's `docs/`.
- Playwright 1.54.1 matches the cached `chromium_headless_shell-1181`.

## Scope decisions (user, 2026-10-06)

- Presentational components only; anything bound to Supabase, Stripe, auth or app routes is excluded.
- `components/table-catalyst.tsx` ships as `Table`/`TableRow`/...; `components/table.tsx` is left out because it exports the same names.
- Authored previews for the core set (37 files in `previews/`); the rest ship the floor card: TableHead, TableBody, TableRow, TableHeader, TableCell, PaginationNextPrev, DividerWithHeader, Subtitle, RelativeTime, EmptyAvatar, GeneratedAvatar, UserAvatarAndBadge, UserBadge, CardlessProfile, CardlessProject, AiWrittenIcon, ProjectScoreFlags, RegranterTag, SponsoredTag.

## Known render warns

- `[RENDER_THIN]` IconButton and RightCarrotIcon: icon-only previews with no text; screenshots confirmed fine.
- `[RENDER_THIN]` Modal: renders through a portal with fixed positioning, so measured height is 0; screenshot confirmed fine.
- Floor-card components that take a `profile`/`project` row log a TypeError in the render check (no props supplied); they fall back to the floor card as designed.

## Not previewable statically

- Tooltip, InfoTooltip, and the badge tooltips only open on hover; previews show the trigger.
- Select shows the closed state only.

## Re-sync risks

- `dtsPropsFor` in config.json is hand-written for Input, Checkbox, RadioButton, AmountInput, Tooltip, SmallStat, Tabs, ProfileCard, CardlessProfile, UserAvatarAndBadge, ProjectCard and CardlessProject. It goes stale if those props, or the `profiles`/`projects` columns the cards read, change.
- `mocks.ts` mirrors the fields ProjectCard and ProfileCard read; a new required field will crash those previews.
- A new component must be added to both `entry.tsx` and (if its file name differs from its export) `componentSrcMap`, plus a `docs/<Name>.md` category stub.
- The compiled stylesheet only contains classes used somewhere in the app or previews. Removing app code can remove classes that `conventions.md` lists; re-validate that file against `_ds_bundle.css` on each sync.
- Several components build class names dynamically (`bg-${color}-100` in Tag, AlertBox, RoundTag); they rely on those classes appearing literally elsewhere in the app.
- Fonts load from Google Fonts at runtime; nothing is bundled.
