import { RoundTag } from 'manifund'

export const Rounds = () => (
  <div className="flex flex-wrap items-center gap-2">
    <RoundTag roundTitle="Regrants" roundSlug="regrants" />
    <RoundTag roundTitle="ACX Mini-Grants" roundSlug="acx-mini-grants" />
    <RoundTag roundTitle="Independent" />
  </div>
)
