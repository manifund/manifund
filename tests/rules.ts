// Which product rules have tests: reads the rule ids (e.g. C12) from docs/product/*/README.md and
// looks for them in test names under tests/. `bun run test:rules`. Local, no services needed.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : files(p)) : [p]
  })

const docs = files(join(root, 'docs', 'product')).filter((f) => f.endsWith('README.md'))
const tests = files(join(root, 'tests')).filter((f) => /\.(test|e2e)\.ts$/.test(f))
const testText = tests.map((f) => [relative(root, f), readFileSync(f, 'utf8')] as const)

let missing = 0
for (const doc of docs) {
  const rules = [...readFileSync(doc, 'utf8').matchAll(/^- \*\*([A-Z]\d+)\*\*/gm)].map((m) => m[1])
  if (!rules.length) continue
  console.log(`\n${relative(root, doc)}: ${rules.length} rules`)
  for (const id of rules) {
    const re = new RegExp(`\\b${id}\\b`)
    const where = testText.filter(([, t]) => re.test(t)).map(([f]) => f.replace(/^tests\//, ''))
    const todo = testText.some(([, t]) => new RegExp(`todo\\([^)]*${id}\\b`).test(t))
    if (!where.length) missing++
    console.log(`  ${id.padEnd(4)} ${where.length ? where.join(', ') : todo ? '(todo)' : '— no test'}`)
  }
}
console.log(`\n${missing} rule(s) without a test`)
