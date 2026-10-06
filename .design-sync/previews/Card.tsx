import { Card } from 'manifund'

export const Default = () => (
  <div className="bg-gray-50 p-6">
    <Card className="w-80">
      <h3 className="font-semibold text-gray-900">Your balance</h3>
      <p className="mt-1 text-2xl font-semibold text-orange-600">$12,000</p>
      <p className="mt-1 text-sm text-gray-500">Available to donate or withdraw.</p>
    </Card>
  </div>
)
