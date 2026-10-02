Prompt: Create a survey we can send to donors on manifund.org/donor-survey. It should be styled nicely with good UX, similarly to Tally.so; simple, easy-to-fill-out, with a touch of Manifund aesthetics. It should be a single page.

Use the frontend design skill when designing everything.

Also:

- Implement a new SQL table for storing user responses.
- Design an interface for viewing a particular (opted-in) donor’s responses, on `manifund.org/<username>/donor` . It should look be structured mostly similarly to the donor form, but prettier
- Design a new dashboard for visualizing aggregate responses, on `manifund.org/donor-survey/results`.
  - Also, at the bottom, show the list of
- Avoid LLM-isms and sounding like slop. Don’t write any copy — use text exactly as below, or add lorem ipsum (if necessary) and I’ll fill it in.

Ask me any questions you have before starting. The survey contents are below:

### Preface

Hey! Austin here, from Manifund. I want to help you figure out where to donate, but I also don’t want to be bugging you too often — I find it awkward to ask for money, and you’re probably drowning in funding requests. So instead: would you take 10 minutes to answer this survey?

Also:

- After filling it out, you’ll get to see what other donors answered!
- We’ll publish the aggregate results in a couple of weeks
- Optionally, you can publish your personal answers. Example: manifund.org/Austin/donor

### Basic questions

- Sign in with Manifund, OR:
  - full name
  - email
    - (if the email matches to a Manifund account, record that)
- in what capacity are you giving?
  - [ ] my own money
  - [ ] i’m a grantmaker
  - [ ] i’m a regrantor or evaluator
- if option 2 or 3: for what org? (one line text)

### Giving questions

- **How much in total are you looking to give, in 2026?**
  - <$50k, $50k-$200k, $200k-$500k, $500k-$2m, $2m-$5m, $5m+
- **In 2027?**
- **What cause areas are you interested in? in what proportion?**
  - (pie chart or slider widget between: AI safety, GHD, Animal Welfare, democracy, political candidates, progress, EA meta, digital minds, biosecurity. [insert your own])
  - initialize to some defaults.
- Where do you currently go for advice about effective giving? (one line text)
- What are your biggest problems with the current giving landscape? (freeform)

### More giving questions

(optional)

- how are you thinking about giving to funds (like Longview and CG) vs selecting individual charities yourself?
  - slider from 0 to 100%, with 25% breakpoints
- Where have you already given? (how much?)
  - Or, drop in a link
- How do you evaluate funds? How do you evaluate charities?
- What are some charities you might like to give to?
- How many hours per month would you ideally spend on donating your money?
  - (looking at opportunities, talking to people, thinking)
  - <1, 1-3, 3-10, 10-30, 30+
- What would your dream setup for donating your money look like? (freeform)
  - (Finding opportunities yourself? Having your own foundation with employees? Pooling with other donors? Donating to funds focused on cause areas? etc, etc)

### Comms questions

- Would you like me to send you opportunities I think you would like? (yes/no)
  - How often? (weekly, monthly, quarterly)
- Would you like to:
  - [ ] meet for 1:1 call with a member of Manifund team?
  - [ ] come to events centered on fundraising for top charities?
- Would you be willing to share your personal answers:
  - [ ] With other major funders (such as CG, Longview, Macroscopic, AISTOF)
  - [ ] On your public Manifund profile? (you can change this later)
    - example: manifund.org/Austin/donor

### Misc

- Other thoughts on effective giving? (freeform)
- Who else should take this survey? (freeform)
  - (if you provide contact info, we’ll reach out and say that you recommended them)

# Next steps, promo

(just FYI)

- [ ] build and publish on manifund.org/donor-survey
  - [ ] also a nice “view results” screen
- [ ] publish short writeup on Manifund substack, and
  - [ ] EA Forum
  - [ ] LessWrong
  - [ ] Twitter
  - [ ] Bountied Rationality (?) HSPEAC (?)
- [ ] ping individuals
  - [ ] everyone on manifund.org/leaderboards
  - [ ] Anthropic people
    - [ ] ask to share with others
  - [ ] Individual LPs
    - [ ] e2g people
  - [ ] Funders — cg grantmakers, etc
  - [ ] Regrantors & regrantor candidates (?)
- [ ] Ask ACX / Scott to promo
- [ ] Ask Lightcone Commons / Oli to share
- [ ] Ask Aella (?)
