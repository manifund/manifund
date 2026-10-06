import { UserLink } from 'manifund'

export const Default = () => <UserLink name="Maria Hobbs" username="mariahobbs" />

export const WithBadges = () => (
  <div className="flex flex-col gap-2 text-sm">
    <UserLink name="Neel Nanda" username="NeelNanda" />
    <UserLink name="Austin Chen" username="Austin" />
    <UserLink name="Maria Hobbs" username="mariahobbs" creatorBadge />
  </div>
)

export const Short = () => (
  <UserLink name="Alexandra Bates-Whitfield" username="alexandraabates" short />
)
