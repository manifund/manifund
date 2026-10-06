import { Tag } from 'manifund'

export const Default = () => <Tag text="Proposal" />

export const Colors = () => (
  <div className="flex flex-wrap gap-2">
    <Tag text="Proposal" color="orange" />
    <Tag text="Active" color="emerald" />
    <Tag text="Not funded" color="rose" />
    <Tag text="Draft" color="gray" />
    <Tag text="Complete" color="blue" />
  </div>
)
