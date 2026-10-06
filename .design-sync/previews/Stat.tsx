import { Stat } from 'manifund'

export const Default = () => (
  <div className="flex gap-10">
    <Stat value="$4.2M" label="raised for projects" />
    <Stat value="312" label="projects funded" />
    <Stat value="1,840" label="donors" />
  </div>
)

export const Gray = () => <Stat value="$62,500" label="raised so far" theme="gray" />

export const White = () => (
  <div className="w-64 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 p-6">
    <Stat value="$250,000" label="regranting budget" theme="white" />
  </div>
)
