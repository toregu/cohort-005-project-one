// PROTOTYPE — throwaway. Answers "How the Feed, push and email look"
// (toregu/cohort-005-project-one#7). Not the real notify module: that shape is
// decided in "Shape of the notify module, Knock adapter and recipient sync".
//
// Talks to the Knock *Development* environment with the keys in .env. Run the
// app with `npm run prototype:notifications` so .env is loaded.

import { Knock, signUserToken } from "@knocklabs/node";
import { eq, ne } from "drizzle-orm";
import { db } from "~/db";
import { courses, lessons, modules, users } from "~/db/schema";
import { formatPrice } from "~/lib/utils";

// Cadence Notification name → Knock workflow key. Purchase receipt is
// email-only and Postmark isn't connected to Knock yet, so it has no workflow;
// it only exists on the email preview.
export const NOTIFICATIONS = [
  { kind: "refund-request-approved", label: "Refund Request approved", to: "Buyer", channels: "F E P" },
  { kind: "refund-request-declined", label: "Refund Request declined", to: "Buyer", channels: "F E P" },
  { kind: "refund-request-opened", label: "New Open Refund Request", to: "Platform Admin", channels: "F E" },
  { kind: "comment-reply", label: "Reply to your Comment", to: "Comment author", channels: "F P" },
  { kind: "course-comment", label: "New Comment on your course", to: "Instructor", channels: "F P" },
  { kind: "course-enrollment", label: "New Enrollment on your course", to: "Instructor", channels: "F" },
  { kind: "seat-claimed", label: "Seat claimed", to: "Team Admin", channels: "F" },
  { kind: "purchase-receipt", label: "Purchase receipt", to: "Buyer", channels: "E" },
] as const;

export type NotificationKind = (typeof NOTIFICATIONS)[number]["kind"];

export function knockClientConfig() {
  const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
  const feedId = process.env.KNOCK_FEED_CHANNEL_ID;
  if (!publicKey || !feedId || !process.env.KNOCK_SIGNING_KEY) return null;
  return { publicKey, feedId };
}

export function firebaseClientConfig() {
  const e = process.env;
  if (!e.FIREBASE_API_KEY) return null;
  return {
    apiKey: e.FIREBASE_API_KEY,
    projectId: e.FIREBASE_PROJECT_ID!,
    messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID!,
    appId: e.FIREBASE_APP_ID!,
    vapidKey: e.FIREBASE_VAPID_KEY!,
  };
}

export function knockUserId(userId: number) {
  return `cadence-user-${userId}`;
}

export function userToken(userId: number) {
  return signUserToken(knockUserId(userId), { expiresInSeconds: 60 * 60 });
}

function knock() {
  return new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
}

function knockUser(user: typeof users.$inferSelect) {
  return {
    id: knockUserId(user.id),
    name: user.name,
    email: user.email,
    avatar: user.avatarUrl ?? undefined,
  };
}

// Sample data for each Notification, pulled from the seeded DB so the Feed
// reads with real course titles and names.
export function sampleData(kind: NotificationKind, recipientId: number) {
  const course = db.select().from(courses).get()!;
  const lesson = db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .get();
  const actor = db.select().from(users).where(ne(users.id, recipientId)).get()!;
  const lessonUrl = lesson
    ? `/courses/${course.slug}/lessons/${lesson.id}`
    : `/courses/${course.slug}`;

  const base = {
    course_title: course.title,
    course_slug: course.slug,
    course_id: course.id,
  };

  switch (kind) {
    case "refund-request-approved":
      return { actor: null, data: { ...base, amount: formatPrice(4900) } };
    case "refund-request-declined":
      return {
        actor: null,
        data: {
          ...base,
          decline_reason:
            "You've watched more than the Watch Limit for this course.",
        },
      };
    case "refund-request-opened":
      return {
        actor,
        data: {
          ...base,
          amount: formatPrice(4900),
          reason: "The course moved too fast for me.",
        },
      };
    case "comment-reply":
      return {
        actor,
        data: {
          ...base,
          lesson_title: lesson?.title ?? "Lesson",
          url: lessonUrl,
          excerpt: "Good question — the loader runs on the server first, so…",
        },
      };
    case "course-comment":
      return {
        actor,
        data: {
          ...base,
          lesson_title: lesson?.title ?? "Lesson",
          url: lessonUrl,
          excerpt: "Is there a reason we don't use useEffect for this?",
        },
      };
    case "course-enrollment":
      return { actor, data: base };
    case "seat-claimed":
      return { actor, data: { ...base, seats_claimed: 3, seats_total: 10 } };
    case "purchase-receipt":
      return { actor: null, data: { ...base, amount: formatPrice(4900) } };
  }
}

// Fire one Notification at the current user, whatever their role, so every
// kind can be seen in one Feed.
export async function triggerAsPrototype(kind: NotificationKind, userId: number) {
  const recipient = db.select().from(users).where(eq(users.id, userId)).get()!;
  const { actor, data } = sampleData(kind, userId);
  return knock().workflows.trigger(kind, {
    recipients: [knockUser(recipient)],
    actor: actor ? knockUser(actor) : undefined,
    data,
  });
}

export async function registerPushToken(userId: number, token: string) {
  const channelId = process.env.KNOCK_FCM_CHANNEL_ID;
  if (!channelId) throw new Error("KNOCK_FCM_CHANNEL_ID is not set");
  const recipient = db.select().from(users).where(eq(users.id, userId)).get()!;
  await knock().users.update(knockUserId(userId), knockUser(recipient));
  await knock().users.setChannelData(knockUserId(userId), channelId, {
    data: { tokens: [token] },
  });
}
