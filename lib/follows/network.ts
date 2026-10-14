// Pure: what people the viewer follows did on each project (docs/product/follows, F8). Shared by home (client), the
// project page (server) and the unit tests.
export type NetworkKind = 'created' | 'donated' | 'offered' | 'commented'
export type NetworkItem = { name: string; kind: NetworkKind }
export type NetworkActivity = Record<string, NetworkItem[]>

// F8: the context line above a home card and a project's title (TENTATIVE): up to two people, each named once with
// what they did ("Maya donated and commented, Sam offered"), then how many more. No "From your network" label (Vals,
// 2026-10-12): the icon says it. Creating isn't mentioned: the card already shows the creator.
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
  // one kind across everyone gets that kind's icon; a mix gets the people icon
  const kinds = new Set(people.flatMap((p) => p.kinds))
  return {
    shown: people.slice(0, 2),
    more: Math.max(0, people.length - 2),
    kind: kinds.size === 1 ? (Array.from(kinds)[0] as NetworkKind) : null,
  }
}

export function networkText(items: NetworkItem[] | undefined) {
  const n = networkPeople(items)
  if (!n) return null
  const first = n.shown.map((p) => `${p.name} ${andList(p.kinds)}`)
  return `${first.join(', ')}${n.more ? ` and ${n.more} more` : ''}`
}

export const andList = (words: string[]) =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
