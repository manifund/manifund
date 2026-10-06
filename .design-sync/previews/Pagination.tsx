import { useState } from 'react'
import { Pagination } from 'manifund'

function Pager(props: { initial: number; totalItems: number }) {
  const [page, setPage] = useState(props.initial)
  return (
    <div className="w-[32rem]">
      <Pagination page={page} setPage={setPage} itemsPerPage={20} totalItems={props.totalItems} />
    </div>
  )
}

export const FirstPage = () => <Pager initial={1} totalItems={90} />
export const MiddleOfMany = () => <Pager initial={6} totalItems={480} />
