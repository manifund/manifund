import { Input } from 'manifund'

export const Default = () => (
  <div className="flex w-80 flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">Project title</label>
    <Input placeholder="e.g. Open benchmarks for SAE evaluation" />
  </div>
)

export const Filled = () => (
  <div className="flex w-80 flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">Full name</label>
    <Input defaultValue="Maria Hobbs" />
  </div>
)

export const WithError = () => (
  <div className="flex w-80 flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">Username</label>
    <Input defaultValue="maria hobbs" error errorMessage="Usernames can't contain spaces." />
  </div>
)

export const Disabled = () => (
  <div className="flex w-80 flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">Email</label>
    <Input defaultValue="maria@example.org" disabled />
  </div>
)
