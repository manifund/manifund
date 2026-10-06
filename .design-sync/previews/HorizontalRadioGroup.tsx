import { useState } from 'react'
import { HorizontalRadioGroup } from 'manifund'

const OPTIONS = { grant: 'Grant', cert: 'Impact certificate', loan: 'Loan' }

function Group(props: { wide?: boolean }) {
  const [value, setValue] = useState('grant')
  return (
    <div className="w-96">
      <HorizontalRadioGroup value={value} onChange={setValue} options={OPTIONS} wide={props.wide} />
    </div>
  )
}

export const Default = () => <Group />
export const Wide = () => <Group wide />
