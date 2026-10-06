import { Button } from 'manifund'

export const Primary = () => <Button>Donate</Button>

export const Colors = () => (
  <div className="flex flex-wrap gap-3">
    <Button color="orange">Orange</Button>
    <Button color="light-orange">Light orange</Button>
    <Button color="orange-outline">Orange outline</Button>
    <Button color="emerald">Emerald</Button>
    <Button color="emerald-outline">Emerald outline</Button>
    <Button color="rose">Rose</Button>
    <Button color="rose-outline">Rose outline</Button>
    <Button color="gray">Gray</Button>
    <Button color="gray-outline">Gray outline</Button>
    <Button color="gray-white">Gray white</Button>
    <Button color="gradient">Gradient</Button>
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="2xs">2xs</Button>
    <Button size="xs">xs</Button>
    <Button size="sm">sm</Button>
    <Button size="md">md</Button>
    <Button size="lg">lg</Button>
    <Button size="xl">xl</Button>
    <Button size="2xl">2xl</Button>
  </div>
)

export const Disabled = () => (
  <div className="flex flex-wrap gap-3">
    <Button disabled>Submit proposal</Button>
    <Button color="gray" disabled>
      Cancel
    </Button>
    <Button color="light-orange" loading>
      Saving
    </Button>
  </div>
)
