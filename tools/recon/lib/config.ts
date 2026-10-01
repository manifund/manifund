import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { setAccountMap } from './parsers'
import { setPayeeRules } from './categorize'

// Private local config (gitignored under data/): bank account mappings and
// payee categorization rules stay out of the public repo.
export type LocalConfig = {
  // last-4 digits of Mercury account -> source key
  mercuryAccounts: Record<string, string>
  // ordered payee rules; pattern is a case-insensitive regex source
  payeeRules: { pattern: string; category: string; inflowTo?: string }[]
}

const CONFIG_PATH = join(import.meta.dir, '..', 'data', 'config.json')

const TEMPLATE: LocalConfig = {
  mercuryAccounts: { '0000': 'mercury_grants', '1111': 'mercury_mox' },
  payeeRules: [{ pattern: 'Some Payroll Provider', category: 'payroll' }],
}

export function loadLocalConfig(): LocalConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(join(import.meta.dir, '..', 'data'), { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(TEMPLATE, null, 2))
    console.warn(
      `recon: wrote template config to ${CONFIG_PATH} — fill in mercuryAccounts and payeeRules`
    )
    return null
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as LocalConfig
  setAccountMap(config.mercuryAccounts ?? {})
  setPayeeRules(
    (config.payeeRules ?? []).map((r) => ({
      pattern: new RegExp(r.pattern, 'i'),
      category: r.category,
      inflowTo: r.inflowTo,
    }))
  )
  return config
}
