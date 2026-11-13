import { describe, it, expect } from "vitest";
import {
  decideRefundEligibility,
  getDaysLeftInRefundWindow,
  REFUND_WATCH_LIMIT_SECONDS,
  type HolderProgress,
  type RefundFacts,
} from "./refund-eligibility";

const purchasedAt = new Date(2026, 10, 1, 23, 0).toISOString();

function facts(overrides: Partial<RefundFacts> = {}): RefundFacts {
  return {
    purchasedAt,
    amountPaid: 7900,
    hasOpenRefundRequest: false,
    hasDeclinedRefundRequest: false,
    lessonCount: 10,
    holders: [holder()],
    ...overrides,
  };
}

function holder(overrides: Partial<HolderProgress> = {}): HolderProgress {
  return { completedLessonCount: 0, secondsWatched: 0, ...overrides };
}

describe("decideRefundEligibility", () => {
  it("offers the amount paid inside the Refund Window", () => {
    expect(decideRefundEligibility(facts(), new Date(2026, 10, 2))).toEqual({
      eligible: true,
      amount: 7900,
      lastDayInWindow: "2026-11-15",
    });
  });

  it("still allows the whole fourteenth day", () => {
    const result = decideRefundEligibility(facts(), new Date(2026, 10, 15, 23, 59));
    expect(result.eligible).toBe(true);
  });

  it("refuses once the Refund Window has closed", () => {
    expect(decideRefundEligibility(facts(), new Date(2026, 10, 16))).toEqual({
      eligible: false,
      reason: "window-closed",
    });
  });

  it("refuses when a Refund Request is already open", () => {
    const result = decideRefundEligibility(
      facts({ hasOpenRefundRequest: true }),
      new Date(2026, 10, 2)
    );
    expect(result).toEqual({ eligible: false, reason: "open-request" });
  });

  it("refuses once a Refund Request has been declined", () => {
    const result = decideRefundEligibility(
      facts({ hasDeclinedRefundRequest: true }),
      new Date(2026, 10, 2)
    );
    expect(result).toEqual({ eligible: false, reason: "declined-before" });
  });

  it("refuses once half the lessons are completed", () => {
    const result = decideRefundEligibility(
      facts({ holders: [holder({ completedLessonCount: 5 })] }),
      new Date(2026, 10, 2)
    );
    expect(result).toEqual({ eligible: false, reason: "completed-too-much" });
  });

  it("refuses once two hours have been watched", () => {
    const result = decideRefundEligibility(
      facts({ holders: [holder({ secondsWatched: REFUND_WATCH_LIMIT_SECONDS })] }),
      new Date(2026, 10, 2)
    );
    expect(result).toEqual({ eligible: false, reason: "watched-too-much" });
  });

  it("allows a course with no lessons", () => {
    const result = decideRefundEligibility(
      facts({ lessonCount: 0 }),
      new Date(2026, 10, 2)
    );
    expect(result.eligible).toBe(true);
  });

  describe("team purchases", () => {
    it("allows a team purchase where nobody has claimed a seat", () => {
      const result = decideRefundEligibility(
        facts({ holders: [] }),
        new Date(2026, 10, 2)
      );
      expect(result.eligible).toBe(true);
    });

    it("allows claimed seats while each Seat Holder is under the limits", () => {
      const result = decideRefundEligibility(
        facts({
          holders: [
            holder({ completedLessonCount: 4, secondsWatched: 3600 }),
            holder({ completedLessonCount: 4, secondsWatched: 3600 }),
          ],
        }),
        new Date(2026, 10, 2)
      );
      expect(result.eligible).toBe(true);
    });

    it("refuses when any one Seat Holder has watched too much", () => {
      const result = decideRefundEligibility(
        facts({
          holders: [
            holder(),
            holder({ secondsWatched: REFUND_WATCH_LIMIT_SECONDS }),
          ],
        }),
        new Date(2026, 10, 2)
      );
      expect(result).toEqual({ eligible: false, reason: "watched-too-much" });
    });

    it("refuses when any one Seat Holder has completed too much", () => {
      const result = decideRefundEligibility(
        facts({ holders: [holder(), holder({ completedLessonCount: 5 })] }),
        new Date(2026, 10, 2)
      );
      expect(result).toEqual({ eligible: false, reason: "completed-too-much" });
    });
  });
});

describe("getDaysLeftInRefundWindow", () => {
  it("counts the purchase day as the first of fifteen days in the window", () => {
    expect(getDaysLeftInRefundWindow(purchasedAt, new Date(2026, 10, 1))).toBe(15);
  });

  it("has one day left on the last day in the window", () => {
    expect(getDaysLeftInRefundWindow(purchasedAt, new Date(2026, 10, 15, 23))).toBe(1);
  });

  it("has none left once the window has closed", () => {
    expect(getDaysLeftInRefundWindow(purchasedAt, new Date(2026, 10, 16))).toBe(0);
  });
});
