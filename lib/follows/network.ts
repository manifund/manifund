// Pure: what people the viewer follows did on each project (docs/product/follows, F8). Shared by home (client), the
// project page (server) and the unit tests.
export type NetworkKind = 'created' | 'donated' | 'offered' | 'commented'
export type NetworkItem = { name: string; kind: NetworkKind }
export type NetworkActivity = Record<string, NetworkItem[]>

// F8: the network line (TENTATIVE): up to two people, each named once with what they did ("Maya donated and
// commented, Sam offered"), then how many more. No "From your network" label (Vals, 2026-10-12): the line's people
// icon says it. Creating isn't mentioned: the card already shows the creator.
export function networkText(items: NetworkItem[] | undefined) {
  const byPerson = new Map<string, NetworkKind[]>()
  for (const i of items ?? []) {
    if (i.kind === 'created') continue
    const kinds = byPerson.get(i.name) ?? []
    if (!kinds.includes(i.kind)) kinds.push(i.kind)
    byPerson.set(i.name, kinds)
  }
  if (!byPerson.size) return null
  const people = Array.from(byPerson.entries())
  const first = people.slice(0, 2).map(([name, kinds]) => `${name} ${andList(kinds)}`)
  const more = people.length > 2 ? ` and ${people.length - 2} more` : ''
  return `${first.join(', ')}${more}`
}

const andList = (words: string[]) =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
