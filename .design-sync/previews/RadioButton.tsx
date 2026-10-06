import { RadioButton } from 'manifund'

export const Options = () => (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <RadioButton name="visibility" defaultChecked />
      Public: anyone can see this donation
    </label>
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <RadioButton name="visibility" />
      Anonymous: hide my name
    </label>
  </div>
)
