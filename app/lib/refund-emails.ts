import { formatPrice } from "~/lib/utils";

// The emails sent when a Platform Admin decides a Refund Request. There is no
// mail transport wired up yet, so callers send the built message to the log.

export type Email = { to: string; subject: string; body: string };

export function buildRefundApprovedEmail(input: {
  purchaserName: string;
  purchaserEmail: string;
  courseTitle: string;
  amount: number;
}): Email {
  return {
    to: input.purchaserEmail,
    subject: `Refund approved — ${input.courseTitle}`,
    body: [
      `Hi ${input.purchaserName},`,
      "",
      `We have approved your refund request for "${input.courseTitle}".`,
      `${formatPrice(input.amount)}, the amount you paid, is on its way back to you.`,
      "You no longer have access to the course.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}

export function buildRefundDeclinedEmail(input: {
  purchaserName: string;
  purchaserEmail: string;
  courseTitle: string;
  declineReason: string;
}): Email {
  return {
    to: input.purchaserEmail,
    subject: `Refund request declined — ${input.courseTitle}`,
    body: [
      `Hi ${input.purchaserName},`,
      "",
      `We have looked at your refund request for "${input.courseTitle}" and cannot approve it.`,
      "",
      input.declineReason,
      "",
      "You keep your access to the course.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}

export function buildSeatRemovedEmail(input: {
  seatHolderName: string;
  seatHolderEmail: string;
  courseTitle: string;
}): Email {
  return {
    to: input.seatHolderEmail,
    subject: `Your access to ${input.courseTitle} has ended`,
    body: [
      `Hi ${input.seatHolderName},`,
      "",
      `Your seat on "${input.courseTitle}" came from a team purchase that has been refunded, so you no longer have access to the course.`,
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}

export function logEmail(email: Email) {
  console.log(`[email] to=${email.to} subject=${email.subject}\n${email.body}`);
}
