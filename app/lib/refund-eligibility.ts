// ─── Refund Eligibility ───
// The rules for whether a purchase can still get a Refund Request. Pure, so the
// course page (which decides whether to offer one) and the refund route (which
// enforces it) cannot drift apart. The facts are gathered in refunds.server.ts.

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

// How far one person who has the course through the purchase has got. For an
// individual purchase that is the Purchaser; for a team purchase it is each
// Seat Holder (the Purchaser only if they claimed a seat themselves).
export type HolderProgress = {
  completedLessonCount: number;
  secondsWatched: number;
};

export type RefundFacts = {
  purchasedAt: string;
  amountPaid: number;
  hasOpenRefundRequest: boolean;
  hasDeclinedRefundRequest: boolean;
  lessonCount: number;
  holders: HolderProgress[];
};

export type RefundIneligibleReason =
  | "open-request"
  | "declined-before"
  | "window-closed"
  | "watched-too-much"
  | "completed-too-much";

export type RefundEligibility =
  | { eligible: true; amount: number; lastDayInWindow: string }
  | { eligible: false; reason: RefundIneligibleReason };

// The Refund Window is counted in whole calendar days, not hours — someone who
// buys at 23:00 still gets the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLastDayInRefundWindow(purchasedAt: string): string {
  const windowEnd = new Date(purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);
  return calendarDay(windowEnd);
}

/**
 * Whole calendar days left in the Refund Window, counting today. 0 or less
 * means the window has closed.
 */
export function getDaysLeftInRefundWindow(purchasedAt: string, now: Date) {
  const lastDay = new Date(purchasedAt);
  lastDay.setDate(lastDay.getDate() + REFUND_WINDOW_DAYS);
  lastDay.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((lastDay.getTime() - today.getTime()) / 86_400_000) + 1;
}

export function decideRefundEligibility(
  facts: RefundFacts,
  now: Date
): RefundEligibility {
  if (facts.hasOpenRefundRequest) {
    return { eligible: false, reason: "open-request" };
  }

  // A decline is final: a purchase gets at most one declined Refund Request.
  if (facts.hasDeclinedRefundRequest) {
    return { eligible: false, reason: "declined-before" };
  }

  const purchasedDay = calendarDay(new Date(facts.purchasedAt));
  const lastDayInWindow = getLastDayInRefundWindow(facts.purchasedAt);
  const today = calendarDay(now);

  if (today < purchasedDay || today > lastDayInWindow) {
    return { eligible: false, reason: "window-closed" };
  }

  // Each holder is held to the limits on their own — progress is never pooled
  // across a team.
  const hasCompletedTooMuch = (holder: HolderProgress) =>
    facts.lessonCount > 0 &&
    holder.completedLessonCount / facts.lessonCount >= REFUND_COMPLETION_LIMIT;

  if (facts.holders.some(hasCompletedTooMuch)) {
    return { eligible: false, reason: "completed-too-much" };
  }

  if (
    facts.holders.some(
      (holder) => holder.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS
    )
  ) {
    return { eligible: false, reason: "watched-too-much" };
  }

  // A Refund is always what the learner actually paid.
  return { eligible: true, amount: facts.amountPaid, lastDayInWindow };
}
