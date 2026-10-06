# Building with Manifund components

Manifund is a funding platform. Its UI is plain, light and text-first: white cards on a `bg-gray-50` page, gray text, and orange as the one accent colour.

## Setup

- No provider or theme wrapper is needed. Load `styles.css` and `_ds_bundle.js`, then use components from `window.Manifund` (`const { Button, Card, Row, Col } = window.Manifund`).
- `styles.css` sets the body font to Readex Pro. Do not set another font family; `font-josefin` and `font-satisfy` exist only for rare display headings.
- Links (`SiteLink`, `Tabs`, `CauseTag`, `ProjectCard`, `UserLink`) render plain `<a>` tags, and `Avatar` and `Pagination` do not navigate. Handle navigation yourself with `onClick` or `href`.
- `Modal` renders nothing unless `open` is true; control it with `open` and `setOpen` from `useState`. `Tooltip` and `InfoTooltip` show their text on hover only.
- `Select`, `Slider`, `AmountInput`, `SearchBar`, `HorizontalRadioGroup` and `Pagination` are controlled: pass the value and its setter from `useState`. `Pagination`'s `page` is 1-indexed.
- `Tabs` takes `tabs: { name, id, count?, display }[]`, where `display` is the panel JSX.
- `Table` is composed: `Table > TableHead > TableRow > TableHeader`, and `TableBody > TableRow > TableCell`. Props `striped`, `dense` and `grid` go on `Table`.
- `ProjectCard`, `ProfileCard`, `CardlessProject`, `CardlessProfile` and `UserAvatarAndBadge` take whole database rows (`project`, `profile`). Read their `.d.ts` for the fields each one needs, and pass `bids`, `txns`, `comments`, `project_votes`, `project_transfers` and `causes` as arrays (empty is fine).

## Styling idiom: Tailwind utility classes

Style your own layout with Tailwind CSS v3 classes in `className`. The stylesheet is precompiled, so a class works only if it already appears in `_ds_bundle.css`; there is no JIT. Stay with the common classes below, and use an inline `style` for any one-off value (an arbitrary width, a custom colour).

| Purpose | Classes |
|---|---|
| Page and surfaces | `bg-gray-50` (page), `bg-white`, `bg-gray-100`, `rounded-md`, `rounded-lg`, `rounded-full`, `shadow`, `shadow-sm`, `shadow-md` |
| Text colour | `text-gray-900` (headings), `text-gray-700`, `text-gray-600` (body), `text-gray-500`, `text-gray-400` (muted) |
| Accent | `text-orange-600`, `text-orange-500`, `bg-orange-500`, `bg-orange-100`, `border-orange-500`, `bg-gradient-to-r from-orange-500 to-rose-500` |
| Status | `text-emerald-500` / `bg-emerald-500` (positive), `text-rose-500` / `bg-rose-500` (negative or destructive), `bg-amber-50` + `text-amber-800` (warning) |
| Type scale | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`; `font-light`, `font-medium`, `font-semibold`, `font-bold`; `leading-tight`, `tracking-tight` |
| Layout | `flex`, `flex-col`, `flex-wrap`, `items-center`, `justify-between`, `justify-center`, `grid`, `grid-cols-2`, `grid-cols-3`, `sm:grid-cols-2`, `lg:grid-cols-3`, `w-full`, `max-w-md`, `max-w-2xl`, `max-w-7xl`, `mx-auto` |
| Spacing | `p-2`, `p-3`, `p-4`, `p-6`, `px-4`, `py-2`, `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `mt-1`, `mt-2`, `mt-4`, `mt-6`, `mb-2`, `mb-4`, `space-y-4` |
| Borders | `border`, `border-2`, `border-gray-200`, `border-gray-300`, `ring-1`, `ring-gray-300`, `divide-y` |
| Text behaviour | `truncate`, `line-clamp-2`, `line-clamp-3`, `text-center`, `text-right`, `hover:underline` |

Prefer the layout components over raw flex divs: `Row` is `flex flex-row`, `Col` is `flex flex-col`, and `Card` is a white rounded panel with padding and a shadow. All three accept `className`.

Colour and size on components come from props, not classes: `Button` takes `color` (`orange` is the default; also `light-orange`, `orange-outline`, `emerald`, `rose`, `gray`, `gray-outline`, `gray-white`, `gradient`) and `size` (`2xs` to `2xl`); `Tag` takes `color` (`orange`, `emerald`, `rose`, `gray`, `blue`); `AlertBox` takes `type` (`error`, `warning`, `info`, `success`).

## Where the truth lives

- `_ds_bundle.css` (imported by `styles.css`): the full set of classes that exist. Search it before using a class not listed above.
- `components/<group>/<Name>/<Name>.prompt.md` and `<Name>.d.ts`: props and usage examples for each component.

## Example

```jsx
const { Card, Col, Row, Button, Tag, ProgressBar, Input } = window.Manifund

function DonatePanel() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Card className="mx-auto max-w-md">
        <Col className="gap-3">
          <Row className="items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Wastewater monitoring pilot</h2>
            <Tag text="Active" color="emerald" />
          </Row>
          <ProgressBar amountRaised={62500} fundingGoal={85000} minFunding={30000} />
          <p className="text-sm text-gray-500">$62,500 raised of $85,000</p>
          <Input placeholder="Add a note for the team" />
          <Row className="justify-end gap-2">
            <Button color="gray">Cancel</Button>
            <Button>Donate</Button>
          </Row>
        </Col>
      </Card>
    </div>
  )
}
```
