import { DataBox } from 'manifund'

export const Default = () => (
  <div className="flex">
    <DataBox value="$12,000" label="Balance" />
    <DataBox value={184000} label="Given" />
    <DataBox value={23} label="Projects" />
  </div>
)

export const Orange = () => (
  <div className="flex">
    <DataBox value="$250,000" label="Regranting budget" color="orange" />
  </div>
)
