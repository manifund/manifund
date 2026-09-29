// Structured logging: one JSON line per event, so Vercel's log search (and any future log drain)
// can filter by event name and ids. Use a stable dotted event name ("comment.posted") and put
// ids in fields; never put email addresses or comment text in logs.

type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

function write(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, event, ...fields, at: new Date().toISOString() }, (_, v) =>
    v instanceof Error ? { name: v.name, message: v.message } : v
  )
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
}
