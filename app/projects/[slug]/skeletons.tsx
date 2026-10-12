// Placeholders shaped like the project page, shown while its data loads.

function Bar(props: { className: string }) {
  return <div className={`rounded bg-gray-200 ${props.className}`} />
}

export function ProjectPageSkeleton() {
  return (
    <div className="animate-pulse p-4" aria-busy="true" aria-label="Loading project">
      <div className="flex items-center gap-3">
        <Bar className="h-8 w-8 rounded-full" />
        <Bar className="h-7 flex-1" />
        <Bar className="h-6 w-10" />
      </div>
      <div className="mt-3 flex gap-1">
        <Bar className="h-5 w-24" />
        <Bar className="h-5 w-20" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Bar className="h-6 w-6 rounded-full" />
        <Bar className="h-4 w-48" />
      </div>
      <div className="mt-6 flex flex-col gap-4 border-y border-gray-200 py-6">
        <Bar className="h-5 w-40" />
        <Bar className="h-3 w-full" />
        <Bar className="h-12 w-full" />
        <Bar className="h-24 w-full" />
      </div>
      <div className="mt-4 flex flex-col gap-2 px-3">
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-4/5" />
      </div>
    </div>
  )
}

export function ProjectTabsSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-busy="true" aria-label="Loading comments">
      <div className="flex gap-6 border-b border-gray-200 pb-2">
        <Bar className="h-5 w-24" />
        <Bar className="h-5 w-16" />
        <Bar className="h-5 w-20" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Bar className="h-20 w-full" />
        <Bar className="h-20 w-full" />
      </div>
    </div>
  )
}
