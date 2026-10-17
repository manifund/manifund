// Preloaded for every ai-reference route test file (each file gets its own copy when files run side by side): fail
// fast without a server, and delete the file's projects and people at the end. Warming the pages and the personas'
// profiles happen once per run, in run.ts.
import { afterAll, beforeAll } from 'bun:test'
import { requireServer } from '../helpers/http'
import { cleanWorld } from '../helpers/fixtures'

beforeAll(async () => {
  await requireServer()
})

afterAll(async () => {
  await cleanWorld()
})
