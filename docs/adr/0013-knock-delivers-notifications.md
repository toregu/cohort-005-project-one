# Knock delivers Notifications, behind our own notify module

Cadence sends Notifications on three Channels (web push, the in-app Feed, and email) through Knock, a hosted notification service. We wanted a real notification vendor, not orchestration we build ourselves, and Knock's free tier fits the v1 catalog of 8 Notification types. Email still goes out through our Postmark account, and web push goes through Firebase Cloud Messaging (FCM), because Knock has no plain-VAPID channel. Server code never calls Knock directly. It calls our own `notify` module using Cadence's own Notification type names, and Knock is one adapter behind it, so the server half can move to another vendor without touching callers.

## Considered Options

- **Novu.** Rejected: the free tier caps us at 5 workflows and the catalog needs 8. Self-hosting needs MongoDB, Redis and S3, which goes against ADR 0006.
- **Building it ourselves** (VAPID push, Postmark, a SQLite Feed with SSE, our own workflows). Rejected: about 7–12 dev-days, and it isn't a real notification service.

## Consequences

- **Notification state lives outside SQLite.** Feed history, read/unread state and recipient preferences live in Knock. This is a deliberate exception to ADR 0006: SQLite stays the record of courses, Purchases and Refunds, and notification state belongs to the notification service.
- **The Feed uses Knock's prebuilt React components.** Moving to another vendor means rebuilding the Feed UI and losing Feed history and preferences. We accepted that loss rather than mirroring the state into SQLite now.
- **The Feed renders only in the browser.** The unread badge appears just after the page loads, not in the server HTML.
- **Knock bills each Channel delivery,** so a Notification sent to the Feed and Push counts twice. Past 10k a month, the next tier costs $250/mo.
- **Firebase is needed only for push.** A free FCM project and the Firebase SDK in the service worker. Nothing goes into Firestore.
