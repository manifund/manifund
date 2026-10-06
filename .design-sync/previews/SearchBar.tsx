import { useState } from 'react'
import { SearchBar } from 'manifund'

function Bar(props: { initial: string; placeholder?: string }) {
  const [search, setSearch] = useState(props.initial)
  return (
    <div className="w-96">
      <SearchBar search={search} setSearch={setSearch} placeholder={props.placeholder} />
    </div>
  )
}

export const Empty = () => <Bar initial="" placeholder="Search projects" />
export const WithQuery = () => <Bar initial="interpretability" />
