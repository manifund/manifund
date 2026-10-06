import { useState } from 'react'
import { Select } from 'manifund'

const SORTS = ['Hot', 'Newest', 'Most funded', 'Closing soon']

function Picker(props: { label?: string }) {
  const [selected, setSelected] = useState(SORTS[0])
  return (
    <div className="w-64">
      <Select options={SORTS} selected={selected} onSelect={setSelected} label={props.label} />
    </div>
  )
}

export const Default = () => <Picker />
export const WithLabel = () => <Picker label="Sort by:" />
