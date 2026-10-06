// Builds the /design-sync inputs: the compiled Tailwind stylesheet and the
// .d.ts tree the converter reads prop types from. Run from the repo root:
//   node .design-sync/build.mjs
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const TYPES = '.design-sync/build/types'

run(
  'bunx tailwindcss -c .design-sync/tailwind.config.js -i .design-sync/styles.css -o .design-sync/build/manifund.css'
)

rmSync(TYPES, { recursive: true, force: true })
try {
  run('bunx tsc -p .design-sync/tsconfig.types.json')
} catch {
  // Type errors don't block declaration emit.
}

// tsc leaves `@/` aliases in the emitted .d.ts; rewrite them to relative
// paths so the tree resolves without a paths config.
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.d.ts') ? [p] : []
  })
for (const file of walk(TYPES)) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(/(['"])@\/([^'"]+)\1/g, (_, q, path) => {
    const rel = relative(dirname(file), join(TYPES, path))
    return q + (rel.startsWith('.') ? rel : './' + rel) + q
  })
  if (out !== src) writeFileSync(file, out)
}
// Root entry, so the converter loads the whole tree rather than one folder.
writeFileSync(join(TYPES, 'index.d.ts'), "export * from './.design-sync/entry'\n")
