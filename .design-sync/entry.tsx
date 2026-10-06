// Bundle entry for /design-sync: the presentational components that render
// without Supabase, Stripe or Next server APIs. Add a component here (and to
// componentSrcMap in config.json) to include it in the Claude Design project.
export { default as AlertBox } from '@/components/alert-box'
export { Avatar, EmptyAvatar, GeneratedAvatar } from '@/components/avatar'
export { Button, IconButton, buttonClass } from '@/components/button'
export { DataBox } from '@/components/data-box'
export { DividerWithHeader } from '@/components/divider-with-header'
export { EmptyContent } from '@/components/empty-content'
export { FeatureCard } from '@/components/feature-card'
export { RightCarrotIcon } from '@/components/icons'
export { InfoTooltip } from '@/components/info-tooltip'
export { Input, Checkbox, RadioButton, AmountInput, SearchBar } from '@/components/input'
export { Card } from '@/components/layout/card'
export { Col } from '@/components/layout/col'
export { Row } from '@/components/layout/row'
export { Modal } from '@/components/modal'
export { Pagination, PaginationNextPrev } from '@/components/pagination'
export { ProfileCard, CardlessProfile } from '@/components/profile-card'
export { ProgressBar } from '@/components/progress-bar'
export { ProjectCard, CardlessProject } from '@/components/project-card'
export { HorizontalRadioGroup } from '@/components/radio-group'
export { RelativeTime } from '@/components/relative-time'
export { Select } from '@/components/select'
export { SiteLink, linkClass } from '@/components/site-link'
export { Slider } from '@/components/slider'
export { AiWrittenIcon, ProjectScoreFlags } from '@/components/slop-flag'
export { Stat, SmallStat } from '@/components/stat'
export { Subtitle } from '@/components/subtitle'
export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/table-catalyst'
export { Tabs } from '@/components/tabs'
export {
  RoundTag,
  CauseTag,
  StageIcon,
  RegranterTag,
  Tag,
  SponsoredTag,
  RequiredStar,
} from '@/components/tags'
export { Tooltip } from '@/components/tooltip'
export { UserLink, UserAvatarAndBadge, UserBadge } from '@/components/user-link'
