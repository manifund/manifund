import { useState } from 'react'
import { AmountInput } from 'manifund'

function Field(props: { initial?: number; error?: boolean; errorMessage?: string }) {
  const [amount, setAmount] = useState<number | undefined>(props.initial)
  return (
    <div className="flex w-56 flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Amount (USD)</label>
      <AmountInput
        amount={amount}
        onChangeAmount={setAmount}
        error={props.error}
        errorMessage={props.errorMessage}
      />
    </div>
  )
}

export const Empty = () => <Field />
export const Filled = () => <Field initial={2500} />
export const OverBalance = () => (
  <Field initial={50000} error errorMessage="You only have $12,000 available." />
)
