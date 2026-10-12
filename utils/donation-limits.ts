// Limits on what a person may give a grant project, shared by the donate boxes and the server routes
// (place-bid for offers on a proposal, transfer-money for donations to an active project), so the page and the
// server refuse the same amounts with the same words.

export const MIN_DONATION = 10

// Half a cent of slack: amounts are typed in dollars and cents, and "what's left" can carry float noise.
const SLACK = 0.005

// What's left of the funding goal, given what the project has raised (getAmountRaised: pending offers while a
// proposal, money received once active). Never negative.
export function fundingLeft(fundingGoal: number, amountRaised: number) {
  return Math.max(0, Math.round((fundingGoal - amountRaised) * 100) / 100)
}

// $750, $4.50, $1,234.56
export const usd = (n: number) =>
  `$${n.toLocaleString('en-US', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Why `amount` can't be given now, or null when it can. `left` is fundingLeft() for a grant project, or null when
// there's no goal to respect (a donation to a person or a fund). When less than the minimum is left, exactly
// what's left is allowed, so a project can always be funded to its goal.
export function donationLimitError(amount: number, left: number | null): string | null {
  if (left !== null && left <= 0) {
    return 'This project has reached its funding goal and is not accepting more donations.'
  }
  if (left !== null && amount > left + SLACK) {
    return `This project needs ${usd(left)} more to reach its funding goal, so you can give up to ${usd(left)}.`
  }
  const min = left === null ? MIN_DONATION : Math.min(MIN_DONATION, left)
  if (amount < min - SLACK) {
    return min < MIN_DONATION
      ? `The minimum is ${usd(min)}, what's left of the funding goal.`
      : `The minimum is ${usd(MIN_DONATION)}.`
  }
  return null
}
