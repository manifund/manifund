import { Tooltip, Button } from 'manifund'

// The tooltip itself only appears on hover; these cells show the triggers it wraps.
export const OnText = () => (
  <p className="text-sm text-gray-700">
    Minimum funding:{' '}
    <Tooltip text="The project only proceeds if it raises at least this much.">
      <span className="underline decoration-dotted">$10,000</span>
    </Tooltip>
  </p>
)

export const OnButton = () => (
  <Tooltip text="You need to sign in to donate." placement="bottom">
    <Button disabled>Donate</Button>
  </Tooltip>
)
