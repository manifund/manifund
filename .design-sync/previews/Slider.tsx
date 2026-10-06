import { useState } from 'react'
import { Slider } from 'manifund'

function Demo(props: Partial<React.ComponentProps<typeof Slider>> & { initial: number }) {
  const { initial, ...rest } = props
  const [amount, setAmount] = useState(initial)
  return (
    <div className="w-80 pb-6">
      <Slider amount={amount} onChange={setAmount} {...rest} />
    </div>
  )
}

export const Default = () => <Demo initial={40} />

export const WithMarks = () => (
  <Demo
    initial={50}
    step={25}
    marks={[
      { value: 0, label: '0%' },
      { value: 25, label: '25%' },
      { value: 50, label: '50%' },
      { value: 75, label: '75%' },
      { value: 100, label: '100%' },
    ]}
  />
)

export const Colors = () => (
  <div className="flex flex-col gap-2">
    <Demo initial={30} rangeColor="emerald" />
    <Demo initial={60} rangeColor="rose" />
  </div>
)

export const Disabled = () => <Demo initial={70} disabled />
