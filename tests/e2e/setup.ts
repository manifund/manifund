// Before the browser tests: give the test accounts full profiles (bio, About, a project, donations), so pages
// look like real ones and layout problems show. Local database only.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export default function setup() {
  const db = process.env.TEST_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  if (!/127\.0\.0\.1|localhost/.test(db)) throw new Error('browser tests only run against a local database')
  execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(__dirname, '..', 'fixtures', 'personas.sql')])
}
