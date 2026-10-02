import { test } from 'bun:test'
import { atLeast } from './env'

// test.smoke runs at every level; test.standard skips at TEST_LEVEL=smoke; test.slow only at full.
export const smoke = test
export const standard = atLeast('standard') ? test : test.skip
export const slow = atLeast('full') ? test : test.skip
