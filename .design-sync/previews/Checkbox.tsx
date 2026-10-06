import { Checkbox } from 'manifund'

export const Options = () => (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <Checkbox defaultChecked />
      Email me when someone comments on my project
    </label>
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <Checkbox />
      Email me a weekly digest
    </label>
    <label className="flex items-center gap-2 text-sm text-gray-400">
      <Checkbox disabled />
      Notify my regrantor (unavailable)
    </label>
  </div>
)
