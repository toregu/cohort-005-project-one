// PROTOTYPE — rough Notification emails (toregu/cohort-005-project-one#7).
// Two looks per email: "plain" (today's refund-emails.ts style, text only)
// and "branded" (one-column HTML: wordmark, one sentence, one button, footer).
// Postmark isn't connected to Knock yet, so these are only previewed.

export type EmailKind =
  | "refund-request-approved"
  | "refund-request-declined"
  | "refund-request-opened"
  | "purchase-receipt";

type Draft = {
  subject: string;
  preheader: string;
  greeting: string;
  lines: string[];
  button: { label: string; url: string };
  // Mandatory emails can't be turned off, so the footer says why it was sent
  // instead of offering an unsubscribe.
  mandatory: boolean;
};

const sample = {
  name: "Sam Rivera",
  course: "React Router from Scratch",
  amount: "$49.00",
  admin: "Platform Admin",
};

const drafts: Record<EmailKind, Draft> = {
  "refund-request-approved": {
    subject: `Refund approved — ${sample.course}`,
    preheader: `${sample.amount} is on its way back to you.`,
    greeting: `Hi ${sample.name},`,
    lines: [
      `We've approved your refund request for ${sample.course}.`,
      `${sample.amount}, the full amount you paid, is on its way back to you. It can take 5–10 days to show up.`,
      "You no longer have access to the course.",
    ],
    button: { label: "Browse courses", url: "/courses" },
    mandatory: true,
  },
  "refund-request-declined": {
    subject: `Refund request declined — ${sample.course}`,
    preheader: "You keep your access to the course.",
    greeting: `Hi ${sample.name},`,
    lines: [
      `We've looked at your refund request for ${sample.course} and can't approve it.`,
      "“You've watched more than the Watch Limit for this course.”",
      "You keep your access to the course.",
    ],
    button: { label: "Go to the course", url: "/courses/react-router" },
    mandatory: true,
  },
  "refund-request-opened": {
    subject: `New refund request — ${sample.course}`,
    preheader: `${sample.name} asked for ${sample.amount} back.`,
    greeting: "Hi,",
    lines: [
      `${sample.name} asked for a refund on ${sample.course} (${sample.amount}).`,
      "Their reason: “The course moved too fast for me.”",
    ],
    button: { label: "Review the request", url: "/admin/refunds" },
    mandatory: false,
  },
  "purchase-receipt": {
    subject: `Your receipt — ${sample.course}`,
    preheader: `You paid ${sample.amount}.`,
    greeting: `Hi ${sample.name},`,
    lines: [
      `Thanks for buying ${sample.course}.`,
      `Amount paid: ${sample.amount}`,
      "Date: 13 November 2026",
    ],
    button: { label: "Start the course", url: "/courses/react-router" },
    mandatory: true,
  },
};

function footer(d: Draft) {
  return d.mandatory
    ? "You're getting this email because it's about a payment on your Cadence account. It can't be turned off."
    : "You can turn these emails off in your notification settings.";
}

export function plainEmail(kind: EmailKind) {
  const d = drafts[kind];
  const text = [
    d.greeting,
    "",
    ...d.lines.flatMap((l) => [l, ""]),
    `${d.button.label}: https://cadence.dev${d.button.url}`,
    "",
    "— The Cadence team",
    "",
    "--",
    footer(d),
  ].join("\n");
  return { subject: d.subject, html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;margin:24px">${escape(text)}</pre>` };
}

export function brandedEmail(kind: EmailKind, dark = false) {
  const d = drafts[kind];
  const c = dark
    ? { page: "#1c1c1e", card: "#2a2a2c", text: "#f2f2f2", muted: "#a1a1a6", border: "#3a3a3c", btn: "#f2f2f2", btnText: "#111" }
    : { page: "#f4f4f5", card: "#ffffff", text: "#18181b", muted: "#71717a", border: "#e4e4e7", btn: "#18181b", btnText: "#fff" };
  const html = `<!doctype html><html><body style="margin:0;background:${c.page};font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:${c.text}">
<div style="display:none">${escape(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-weight:700;font-size:18px;letter-spacing:-0.01em">Cadence</td></tr>
<tr><td style="background:${c.card};border:1px solid ${c.border};border-radius:10px;padding:28px">
<p style="margin:0 0 16px;font-size:15px">${escape(d.greeting)}</p>
${d.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escape(l)}</p>`).join("")}
<p style="margin:24px 0 0"><a href="https://cadence.dev${d.button.url}" style="display:inline-block;background:${c.btn};color:${c.btnText};text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">${escape(d.button.label)}</a></p>
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:${c.muted}">${escape(footer(d))}<br>Cadence · hello@cadence.dev</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: d.subject, html };
}

export const EMAIL_KINDS: { kind: EmailKind; label: string }[] = [
  { kind: "refund-request-approved", label: "Refund Request approved (mandatory)" },
  { kind: "refund-request-declined", label: "Refund Request declined (mandatory)" },
  { kind: "refund-request-opened", label: "New Open Refund Request (can turn off)" },
  { kind: "purchase-receipt", label: "Purchase receipt (mandatory)" },
];

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
