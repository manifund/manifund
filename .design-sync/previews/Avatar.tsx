import { Avatar } from 'manifund'

const ID = '7c1e2b9a-3f4d-4c8e-9a51-2d6f0b8e4a13'

export const Sizes = () => (
  <div className="flex items-end gap-4">
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} size="xxs" noLink />
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} size="xs" noLink />
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} size="sm" noLink />
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} noLink />
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} size={24} noLink />
  </div>
)

export const GeneratedPerUser = () => (
  <div className="flex gap-3">
    <Avatar username="mariahobbs" avatarUrl={null} id={ID} noLink />
    <Avatar username="NeelNanda" avatarUrl={null} id="2a9d4f70-8b1c-4e57-b6a3-91c5e0d7f284" noLink />
    <Avatar username="tamay" avatarUrl={null} id="9f3b1d52-6c0e-4a7b-8d24-5e1a7c3f9b06" noLink />
    <Avatar username="rachel" avatarUrl={null} id="4de2634d-3802-4141-881e-9ce687f87485" noLink />
  </div>
)
