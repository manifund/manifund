import { CauseTag } from 'manifund'

export const Causes = () => (
  <div className="flex flex-wrap gap-1">
    <CauseTag causeTitle="Technical AI safety" causeSlug="tais" />
    <CauseTag causeTitle="Biosecurity" causeSlug="biosec" />
    <CauseTag causeTitle="AI governance" causeSlug="ai-gov" />
    <CauseTag causeTitle="Animal welfare" causeSlug="animal-welfare" />
    <CauseTag causeTitle="Global health & development" causeSlug="ghd" />
    <CauseTag causeTitle="Forecasting" causeSlug="forecasting" />
    <CauseTag causeTitle="Science & technology" causeSlug="science" />
  </div>
)

export const NoLink = () => <CauseTag causeTitle="EA community" causeSlug="ea" noLink />
