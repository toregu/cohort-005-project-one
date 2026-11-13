---
status: accepted
---

# How Platform Admins decide Refund Requests

Every Refund Request is decided by hand. A Platform Admin approves or declines it on an admin screen. Team Admins and any "support" role cannot decide one. A Refund is always the full amount paid, and approving it takes the course away from everyone who has it through that purchase. Declining needs a Decline Reason and is final. Cadence has no payment provider, so approving only records the Refund and removes access. The money goes back outside Cadence for now.

## Decisions

- **Only Platform Admins decide.** A Team Admin manages seats but cannot decide refunds, not even for their own team. We chose not to add a separate Support role.
- **All or nothing.** A Refund is always the amount the Purchaser paid. There are no partial refunds and no per-seat refunds on team purchases.
- **The screen informs but never blocks.** Refund Eligibility is enforced when the Purchaser makes the request. At decision time the screen shows the current facts: days left in the Refund Window, watch time, completion, and each Seat Holder's progress. Nothing on the screen stops the Platform Admin from approving after the window has closed or after more watching.
- **A decline is final.** A Decline Reason is required. The Purchaser sees it in their email and on `/settings`. That purchase can never get another Refund Request.
- **Approving removes access.** It deletes the Purchaser's enrollment for an individual purchase, or every Seat Holder's for a team purchase, and voids the purchase's unclaimed codes. The purchase itself and lesson progress are kept for the record.
- **Team purchases are judged one Seat Holder at a time.** A team purchase stays eligible while each Seat Holder is under the usual limits (under 2 hours watched, under half the lessons completed). Only people who have the course through that purchase count. The Purchaser counts only if they hold one of its seats.
- **Redemption is frozen while a request is Open.** A team purchase's codes cannot be redeemed while it has an Open Refund Request. If the request is declined the codes work again, and if it is approved they are voided.

## Considered Options

- **Re-checking eligibility before approving.** We rejected this because a Platform Admin can see context the rules can't. For example, a learner who binged the course because the course itself was broken.
- **Letting a declined Purchaser ask again.** We rejected this because it turns declines into a retry loop. The Decline Reason explains the decision instead.
- **Blocking a team refund once any seat is claimed** (the earlier rule). We rejected this because it was too strict. Seats are often claimed and barely used before a team changes its mind.
- **Refunding only the unclaimed seats.** We rejected this to keep a Refund all-or-nothing.
- **Leaving redemption open while a request is Open,** and only warning the Platform Admin or removing late Seat Holders on approval. We rejected this because freezing redemption means the purchase can't change while it's being reviewed.

## Consequences

- Approving a team refund takes the course away from Seat Holders who never asked for a refund. Each of them gets an email explaining why.
- While no payment provider is wired up, an approved Refund is only a record. Someone has to return the money by hand, and the app cannot confirm that it happened.
