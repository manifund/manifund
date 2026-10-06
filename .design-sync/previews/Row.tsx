import { Row } from 'manifund'

export const Inline = () => (
  <Row className="items-center gap-2">
    <div className="rounded bg-orange-100 px-3 py-2 text-sm text-orange-700">Votes</div>
    <div className="rounded bg-orange-100 px-3 py-2 text-sm text-orange-700">Comments</div>
    <div className="rounded bg-orange-100 px-3 py-2 text-sm text-orange-700">Raised</div>
  </Row>
)

export const SpaceBetween = () => (
  <Row className="w-96 items-center justify-between rounded border border-gray-200 p-3">
    <span className="text-sm font-medium text-gray-900">Wastewater pathogen monitoring pilot</span>
    <span className="text-sm text-gray-500">$62,500</span>
  </Row>
)
