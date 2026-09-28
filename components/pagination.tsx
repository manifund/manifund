// Note: mostly copied from Manifold's pagination.tsx,
// but they used 0-indexed page numbers and masked them, while
// we just use 1-indexed page numbers

'use client'
import clsx from 'clsx'
import { useEffect } from 'react'
import { range } from 'es-toolkit'
import { useRouter, useSearchParams } from 'next/navigation'
import { Row } from './layout/row'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
export const PAGE_ELLIPSES = '...'

export function Pagination(props: {
  page: number
  itemsPerPage: number
  totalItems: number
  setPage: (page: number) => void
  className?: string
  savePageToQuery?: boolean
}) {
  const { page, itemsPerPage, totalItems, setPage, className, savePageToQuery } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageQuery = searchParams?.get('p')

  useEffect(() => {
    if (savePageToQuery) {
      if (pageQuery && page !== parseInt(pageQuery as string)) {
        setPage(parseInt(pageQuery as string))
      } else if (!pageQuery && page !== 1) {
        setPage(1)
      }
    }
  }, [pageQuery])

  const onClick = (page: number) => {
    if (savePageToQuery) {
      const newParams = new URLSearchParams(searchParams ?? '')
      newParams.set('p', `${page}`)
      router.push('?' + newParams.toString())
    }
    setPage(page)
  }

  const maxPage = Math.ceil(totalItems / itemsPerPage) - 1

  if (maxPage <= 0) return <div />

  const pageNumbers = getPageNumbers(maxPage, page)
  return (
    <nav
      className={clsx('flex w-full items-center bg-inherit pb-4 pt-2', className)}
      aria-label="Pagination"
    >
      <Row className="mx-auto gap-4">
        <PaginationArrow onClick={() => onClick(page - 1)} disabled={page <= 0} nextOrPrev="prev" />
        <Row className="gap-2">
          {pageNumbers.map((pageNumber) => (
            <PageNumbers key={pageNumber} pageNumber={pageNumber} setPage={onClick} page={page} />
          ))}
        </Row>
        <PaginationArrow
          onClick={() => onClick(page + 1)}
          disabled={page >= maxPage}
          nextOrPrev="next"
        />
      </Row>
    </nav>
  )
}

export function PaginationArrow(props: {
  onClick: () => void
  disabled: boolean
  nextOrPrev: 'next' | 'prev'
}) {
  const { onClick, disabled, nextOrPrev } = props
  return (
    <div
      onClick={onClick}
      className={clsx(
        'select-none rounded-lg transition-colors',
        disabled
          ? 'pointer-events-none text-ink-200'
          : 'cursor-pointer text-primary-600 hover:bg-ink-100'
      )}
    >
      {nextOrPrev === 'prev' && <ChevronLeftIcon className="h-[24px] w-[24px]" />}
      {nextOrPrev === 'next' && <ChevronRightIcon className="h-[24px] w-[24px]" />}
    </div>
  )
}

// WARNING: These generated `pageNumbers` are 0-indexed, while `page` is 1-indexed
type pageNumbers = number | string
export function PageNumbers(props: {
  pageNumber: pageNumbers
  setPage: (page: number) => void
  page: number
}) {
  const { pageNumber, setPage, page } = props
  if (pageNumber === PAGE_ELLIPSES || typeof pageNumber === 'string') {
    return <div className="select-none text-ink-400">{PAGE_ELLIPSES}</div>
  }
  return (
    <button
      onClick={() => setPage(pageNumber + 1)}
      className={clsx(
        'select-none rounded-lg px-2',
        page === pageNumber + 1
          ? 'bg-primary-100 text-primary-600'
          : 'text-ink-400 hover:bg-ink-100'
      )}
    >
      {pageNumber + 1}
    </button>
  )
}

export function getPageNumbers(maxPage: number, page: number): Array<pageNumbers> {
  if (maxPage <= 7) {
    return range(0, maxPage + 1)
  }
  if (page < 5) {
    return Array.from<unknown, pageNumbers>({ length: 5 }, (_, index) => index).concat([
      PAGE_ELLIPSES,
      maxPage,
    ])
  }
  if (page >= maxPage - 2) {
    return [0, PAGE_ELLIPSES].concat(
      Array.from<unknown, pageNumbers>({ length: 5 }, (_, index) => index + maxPage - 4)
    )
  }
  return [0, PAGE_ELLIPSES, page - 1, page, page + 1, PAGE_ELLIPSES, maxPage]
}
