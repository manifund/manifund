// Pure: what people the viewer follows did on each project (docs/product/follows, F8). Shared by home (client), the
// project page (server) and the unit tests.
export type NetworkKind = 'created' | 'donated' | 'offered' | 'commented'
export type NetworkItem = { name: string; kind: NetworkKind }
export type NetworkActivity = Record<string, NetworkItem[]>

// F8: the context line above a home card and a project's title: up to two people, each named once with what they did
// ("Maya donated and commented, Sam offered"), then how many more. No "From your network" label: the two-people icon
// says it. Posting the project isn't mentioned: the card already shows its creator.
export type NetworkPerson = { name: string; kinds: NetworkKind[] }
export function networkPeople(items: NetworkItem[] | undefined) {
  const byPerson = new Map<string, NetworkKind[]>()
  for (const i of items ?? []) {
    if (i.kind === 'created') continue
    const kinds = byPerson.get(i.name) ?? []
    if (!kinds.includes(i.kind)) kinds.push(i.kind)
    byPerson.set(i.name, kinds)
  }
  if (!byPerson.size) return null
  const people = Array.from(byPerson.entries()).map(([name, kinds]) => ({ name, kinds }))
  return { shown: people.slice(0, 2), more: Math.max(0, people.length - 2) }
}

// The line as plain text (its hover text, and what the unit tests check); the band renders the same parts with the
// names emphasised.
export function networkText(items: NetworkItem[] | undefined) {
  const n = networkPeople(items)
  if (!n) return null
  const first = n.shown.map((p) => `${p.name} ${andList(p.kinds)}`)
  return `${first.join(', ')}${moreText(n.more)}`
}

export const moreText = (more: number) => (more ? ` and ${more} more` : '')

export const andList = (words: string[]) =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
