// Test settings, from the environment or the worktree's .env.development.local (written by the local
// stack). Tests run locally only, against the local Supabase and a running dev server.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(import.meta.dir, '..', '..', '.env.development.local')
const fromFile: Record<string, string> = {}
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) fromFile[m[1]] = m[2]
  }
}
const get = (key: string, fallback?: string) => process.env[key] || fromFile[key] || fallback || ''

export const env = {
  dbUrl: get('TEST_DB_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  supabaseUrl: get('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321'),
  anonKey: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceKey: get('SUPABASE_SERVICE_ROLE_KEY'),
  // The dev server's log (local-dev writes next-<port>.log), to check warnings; optional.
  serverLog: get('TEST_SERVER_LOG', join(import.meta.dir, '..', '..', '..', '..', 'local-dev', `next-${get('PORT', '3002')}.log`)),
  baseUrl: get('TEST_BASE_URL', `http://localhost:${get('PORT', '3002')}`),
  password: get('TEST_PASSWORD', 'localpass123'),
}

// How much to run: `smoke` (the core of each area), `standard` (default), `full` (also slow tests:
// rate limits, grants, the notification sweep). Set with TEST_LEVEL=full.
const LEVELS = ['smoke', 'standard', 'full'] as const
export type Level = (typeof LEVELS)[number]
export const level: Level = (LEVELS as readonly string[]).includes(process.env.TEST_LEVEL ?? '')
  ? (process.env.TEST_LEVEL as Level)
  : 'standard'
export const atLeast = (l: Level) => LEVELS.indexOf(level) >= LEVELS.indexOf(l)
