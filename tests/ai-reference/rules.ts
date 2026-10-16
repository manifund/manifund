// Which ai-reference rules have tests: reads the rule ids (e.g. L12) from docs/ai-reference/*/README.md and
// looks for them in tests/ai-reference/. `bun run test:ai-reference:rules`. Local, no services needed.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : files(p)) : [p]
  })

const docs = files(join(root, 'docs', 'ai-reference')).filter((f) => f.endsWith('README.md'))
const tests = files(join(root, 'tests', 'ai-reference')).filter((f) => /\.(test|e2e)\.tsx?$/.test(f))
const testText = tests.map((f) => [relative(root, f), readFileSync(f, 'utf8')] as const)

let missing = 0
let todos = 0
for (const doc of docs) {
  // Rule lines: "- **L12** …". A rule marked "(retired)" keeps its id but needs no test.
  const lines = [...readFileSync(doc, 'utf8').matchAll(/^- \*\*([A-Z]\d+)\*\*(.*)$/gm)]
  const rules = lines.filter((m) => !/^\s*\(retired\)/.test(m[2])).map((m) => m[1])
  if (!rules.length) continue
  console.log(`\n${relative(root, doc)}: ${rules.length} rules`)
  for (const id of rules) {
    const re = new RegExp(`\\b${id}\\b`)
    const todoRe = new RegExp(`\\.todo\\(\\s*['"\`][^'"\`]*\\b${id}\\b`)
    // A test that names the rule, other than a test.todo (which only says it's still to write).
    const where = testText
      .filter(([, t]) => re.test(t.split('\n').filter((l) => !todoRe.test(l)).join('\n')))
      .map(([f]) => f.replace(/^tests\/ai-reference\//, ''))
    const todo = testText.some(([, t]) => todoRe.test(t))
    if (!where.length) todo ? todos++ : missing++
    console.log(`  ${id.padEnd(4)} ${where.length ? where.join(', ') : todo ? '(todo)' : '— no test'}`)
  }
}
console.log(`\n${missing} rule(s) without a test${todos ? `, ${todos} with only a test.todo` : ''}`)
