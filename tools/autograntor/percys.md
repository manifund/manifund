# PERCYs: pricing opinion change

Use this for any row whose value comes from changing what people think about AI risk: media, audiences, courses,
events, campaigns, games. Convert with **1,000,000 PERCYs = 1,200 points** (`milestones.md` row 79).

**1 PERCY** = one average US adult moved one full unit higher on a −1 to +1 AI-risk opinion scale, held for one
year, quality-weighted.

**PERCYs for a row = people × Q × Δ × Y**

## Q: who the person is

| Bin                                                                                 |          Q |
| ----------------------------------------------------------------------------------- | ---------: |
| General                                                                             |          1 |
| Engaged                                                                             |          3 |
| Professional-adjacent                                                               |         10 |
| Field-insider                                                                       |         30 |
| Decision-maker-adjacent                                                             |        100 |
| Frontier-lab employees, government AI staff, committee staffers, and AI journalists |      3,000 |
| House member or named senior lab researcher                                         |     30,000 |
| Chinese senior academic                                                             |    100,000 |
| Senator                                                                             |    300,000 |
| Frontier lab CEO or cabinet member                                                  |  2,000,000 |
| Leader of US or China                                                               | 20,000,000 |

## Δ and Y: what they get

| Exposure class | What the person gets                                     | Typical shift (Δ) |   Y |
| -------------- | -------------------------------------------------------- | ----------------- | --: |
| Glance         | One short piece: a clip, an ad, something scrolled past  | 0.01–0.03         | 0.5 |
| Long-form      | One documentary, long episode, book or multi-day event   | 0.03–0.08         |   1 |
| Sustained      | A returning audience over a year, a course, a fellowship | 0.10–0.30         |   3 |

## Rules

1. **Split a channel's audience into a returning core (Sustained) and a drive-by tail** (Glance or Long-form, by
   piece length).
2. **Count unique people,** not views. Borrowed reach (a guest spot) is Glance or Long-form.
3. **Uncertain future events** (will the film get distribution; will cohorts run) are forecast questions. Research
   base rates rather than taking the applicant's word, and report any single gate carrying over half the value.
4. **Coverage:** state what share of the grant's theory of change your rows price. If it's mostly not opinion change
   (community, art, infrastructure) or mostly runs through unnamed senior people, say the total is a floor.

## Worked example

**Rob Miles, one year (reference channel).** 650,000 unique viewers; 26% returning.

| Row                                  | Calculation              |                     PERCYs |
| ------------------------------------ | ------------------------ | -------------------------: |
| F core (169,000, Engaged, Sustained) | 169,000 × 3 × 0.12 × 3   |                    182,520 |
| F tail (481,000, Engaged, Long-form) | 481,000 × 3 × 0.04 × 1   |                     57,720 |
| E lab staff (3,000 monthly)          | 3,000 × 3,000 × 0.06 × 3 |                  1,620,000 |
| E journalists (100 monthly)          | 100 × 3,000 × 0.04 × 3   |                     36,000 |
| **Total**                            |                          | **≈1.90M** (≈2,280 points) |

E exceeds F here, as it does for most text, audio and technical channels.
