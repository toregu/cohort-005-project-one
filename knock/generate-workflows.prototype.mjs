// PROTOTYPE — writes the 7 Knock workflows for the v1 Notifications that use
// the Feed or Push (toregu/cohort-005-project-one#7). Purchase receipt is
// email-only and waits on "Connect Postmark to Knock".
//
//   node knock/generate-workflows.prototype.mjs <in-app channel key> <fcm channel key>
//   npx knock workflow push --all --workflows-dir knock/workflows --service-token $KNOCK_SERVICE_TOKEN

import { mkdirSync, writeFileSync } from "node:fs";

const [feedKey, pushKey] = process.argv.slice(2);
if (!feedKey || !pushKey) throw new Error("usage: <in-app channel key> <fcm channel key>");

const lessonUrl = "{{ data.url }}";

const workflows = {
  "refund-request-approved": {
    name: "Refund Request approved",
    feed: {
      body: "**Refund approved** for *{{ data.course_title }}*. {{ data.amount }} is on its way back to you.",
      url: "/courses",
    },
    push: {
      title: "Refund approved",
      body: "{{ data.amount }} for {{ data.course_title }} is on its way back to you.",
      url: "/courses",
    },
  },
  "refund-request-declined": {
    name: "Refund Request declined",
    feed: {
      body: "Your refund request for *{{ data.course_title }}* was **declined**. You keep your access to the course.",
      url: "/courses/{{ data.course_slug }}",
    },
    push: {
      title: "Refund request declined",
      body: "{{ data.course_title }}: you keep your access to the course.",
      url: "/courses/{{ data.course_slug }}",
    },
  },
  "refund-request-opened": {
    name: "New Open Refund Request",
    feed: {
      body: "**{{ actor.name }}** asked for a refund on *{{ data.course_title }}* ({{ data.amount }}).",
      url: "/admin/refunds",
    },
  },
  "comment-reply": {
    name: "Reply to your Comment",
    feed: {
      body: "**{{ actor.name }}** replied to your comment on *{{ data.lesson_title }}*: “{{ data.excerpt }}”",
      url: lessonUrl,
    },
    push: {
      title: "{{ actor.name }} replied to you",
      body: "{{ data.excerpt }}",
      url: lessonUrl,
    },
  },
  "course-comment": {
    name: "New Comment on your course",
    feed: {
      body: "**{{ actor.name }}** commented on *{{ data.lesson_title }}* in {{ data.course_title }}: “{{ data.excerpt }}”",
      url: lessonUrl,
    },
    push: {
      title: "New comment on {{ data.course_title }}",
      body: "{{ actor.name }}: {{ data.excerpt }}",
      url: lessonUrl,
    },
  },
  "course-enrollment": {
    name: "New Enrollment on your course",
    feed: {
      body: "**{{ actor.name }}** enrolled in *{{ data.course_title }}*.",
      url: "/instructor/{{ data.course_id }}/students",
    },
  },
  "seat-claimed": {
    name: "Seat claimed",
    feed: {
      body: "**{{ actor.name }}** claimed a Seat on your *{{ data.course_title }}* Team Licence ({{ data.seats_claimed }} of {{ data.seats_total }} claimed).",
      url: "/team",
    },
  },
};

for (const [key, w] of Object.entries(workflows)) {
  const steps = [
    {
      ref: "in_app_feed_1",
      type: "channel",
      channel_key: feedKey,
      template: { markdown_body: w.feed.body, action_url: w.feed.url },
    },
  ];
  if (w.push) {
    steps.push({
      ref: "push_1",
      type: "channel",
      channel_key: pushKey,
      template: {
        settings: {
          delivery_type: "content",
          // Under test: does Knock pass this through to FCM? The service worker
          // reads data.url on click (fcm_options.link needs an https URL, so
          // it can't point at localhost).
          payload_overrides: JSON.stringify({ data: { url: w.push.url } }),
        },
        title: w.push.title,
        text_body: w.push.body,
      },
    });
  }
  const dir = `knock/workflows/${key}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/workflow.json`,
    JSON.stringify({ name: w.name, steps }, null, 2) + "\n"
  );
  console.log("wrote", dir);
}
