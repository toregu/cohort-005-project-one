# Knock vs Novu vs building it ourselves

Research for [#3](https://github.com/toregu/cohort-005-project-one/issues/3), part of map [#2](https://github.com/toregu/cohort-005-project-one/issues/2). Researched 2026-11-10. All pricing facts are as of that date; vendors change pricing pages often, so re-check before signing up.

Cadence constraints this is measured against: React Router 8 SSR (repo pins `react-router` 8.3.0, React 19), one SQLite file through Drizzle, Postmark stays the email provider, free tier only (cost at scale is a factor, not a disqualifier), **web** push only, live Feed, per-kind and per-Channel preferences with some mandatory Notifications, and a local fallback transport for tests and keyless dev.

This file reports facts. It does not pick an option; that is the job of the decision ticket "Choose Knock, Novu, or build it ourselves".

## Summary table

| Factor | Knock (hosted) | Novu (Cloud) | Build it ourselves |
| --- | --- | --- | --- |
| Free tier | 10,000 **messages**/mo; unlimited workflows and environments; Knock branding in the feed [1] | 10,000 **workflow runs**/mo; **5 workflows max**; 2 environments; 24 h activity log; 3 team members [2][3] | No vendor fees. FCM is free; plain VAPID needs no account at all |
| Billing unit | 1 message = one delivery to one user on one channel. A run that sends Feed + email = 2 messages [4] | 1 run = one workflow execution per subscriber, regardless of how many Channels it reaches [3] | n/a |
| Next tier | Starter $250/mo incl. 50,000 messages, then $0.005/message [1] | Pro from $30/mo (30,000 runs, 20 workflows), Team from $250/mo (250,000 runs, 100 workflows); overage $1.20 per 1,000 runs [2] | Postmark costs only (already paid) |
| Over the free cap | "We don't hard cap your messages"; Knock contacts you about billing [1] | "We never stop or throttle your notifications"; usage moves to on-demand pricing [3] | n/a |
| Live Feed | Yes, real-time over a socket; `new-message` event carries badge counts [5][6] | Yes, Inbox with real-time unread count [7] | We build it: SQLite table + SSE resource route |
| Prebuilt React UI | `@knocklabs/react`: bell, popover, feed, cells; CSS overridable [5] | `@novu/react` (React 18+, 19 supported): Inbox, Bell, Preferences component, headless hooks [7] | None; we build the bell, list and preferences page |
| SSR fit | Docs do not mention SSR; client-side components and socket, so render client-only after hydration (not verified) [5][6] | Docs do not mention SSR; same expectation. Novu has a Remix quickstart (React Router's ancestor), for its Framework not the Inbox [7][14] | Native: loader renders the first page server-side, SSE takes over in the browser |
| Web push | Via **FCM** channel, which documents web push tokens and `webpush` overrides; also OneSignal, APNs, Expo, SNS. No plain-VAPID provider [8][9] | Via FCM (separate FCM integration for web), OneSignal, Pushpad, Pusher Beams, Push Webhook [10] | FCM JS SDK, or plain VAPID with a library such as `web-push` |
| iOS 16.4+ home-screen PWA | Depends on the FCM/OneSignal client, not on Knock | Same | Standard Push API works; needs manifest `display: standalone`, a user gesture, and allowing `*.push.apple.com`. No Apple Developer account needed [11] |
| Postmark | First-class channel: API key, from address, optional delivery/bounce webhook, sandbox mode [12] | First-class integration: server API token + verified sender [13] | Keep using Postmark directly as today |
| Preferences | `PreferenceSet` per workflow, per category, per channel type, per channel; defaults to on; env-level defaults [15] | Workflow-level channel prefs, subscriber global prefs, subscriber per-workflow prefs; most specific wins [16] | Our own table and rules |
| Mandatory Notifications | Workflow setting "Override recipient preferences" sends regardless of preferences [15] | "Critical" workflows ignore subscriber prefs and are hidden from the Preferences UI [16] | Our own flag per Notification kind |
| Delays, batching, digests | Delay, Batch, Throttle, Branch, Wait-for-event, Fetch, Trigger-workflow, and more; batching listed on Free [1][17] | Delay, Digest, Throttle. Max digest window: **Free 1 day**, Pro 7, Team 30 [18] | We build each one (a job runner on SQLite) |
| Local dev / tests | Per-channel sandbox mode (not for in-app); `settings.sandbox_mode` on trigger; Knock CLI pulls workflows as code; sandboxed messages are free [19]. Keyless offline needs our own fake behind the Cadence module | `npx novu dev` opens the Dashboard's Local environment through a tunnel to our Bridge Endpoint; triggers still go through Novu Cloud [20]. Keyless offline needs our own fake | Fully offline by design; the fallback transport is just another adapter |
| Self-hosting | No | Open source (MIT outside `enterprise/`); needs MongoDB, Redis, S3-compatible storage and API/Worker/WS services; some cloud-only features [21][22]. Pricing page lists self-hosted deployment under Enterprise [2] | It is self-hosted |
| Lock-in | Workflows, templates, preferences and Feed history live in Knock. CLI exports workflows as code, but the format is Knock's [19] | Same for Cloud; Framework workflows live in our code. Self-host is an escape hatch but adds Mongo + Redis next to our one SQLite file | None |

## Details

### Pricing and cost at scale

- **Knock** counts every delivery on every Channel. A Notification that lands in the Feed and goes out by email costs 2 messages; a skipped step (preferences, missing data) costs nothing; bounced or failed sends and sandboxed sends are not billed [4]. Free tier: 10,000 messages a month. Starter: $250 a month with 50,000 included, then $0.005 each [1]. Example: 100,000 messages a month on Starter is about $250 + 50,000 × $0.005 = **$500 a month**.
- **Novu** counts workflow runs, one per subscriber per trigger, whatever the Channel count [3]. Free tier: 10,000 runs a month, but only **5 workflows**. Pro starts at $30 a month (30,000 runs, 20 workflows); overage is $1.20 per 1,000 runs [2]. Example: 100,000 runs a month on Pro is about $30 + 70 × $1.20 = **$114 a month**. If each Notification kind becomes a workflow, the 5-workflow cap on Free is the tighter limit: the refund emails alone may use several.
- Feed retention: Knock lists unlimited feed retention on all plans, 30-day logs on Free [1]. Novu Free keeps the activity feed for 24 hours [2]; Inbox retention on Free was not legible on the pricing page.
- Branding: Knock Free shows Knock branding (removal from Starter) [1]. Novu lists "Remove Novu branding" as a Pro feature, which suggests Free shows it [2].

### Live Feed and React components

- Knock: `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton` (badge counts "seen" by default, `badgeCountType="unread"` switches), `NotificationFeedPopover`, `NotificationFeed`. Real-time arrives over a socket; there is an option that drops sockets in inactive tabs and an experimental cross-tab sync through BroadcastChannel [5]. Client SDKs use a public API key, with an "enhanced security mode" that signs requests per user [6]. For Cadence that means the server mints a signed user token.
- Novu: `@novu/react` Inbox with Bell, Notifications, Preferences, tabs, filters, snooze, localization, and headless hooks for a custom UI. React 18+ required; React 19 supported [7].
- SSR: neither vendor's docs describe server rendering for these components. They open sockets in the browser, so in React Router 8 they would render after hydration (a client-only wrapper or lazy import). The unread badge would then not be in the server HTML. This is an inference, not a documented fact; a prototype would confirm it.

### Web push, including iOS

- Knock's FCM channel sends "mobile or web push notifications". The app collects the FCM web token in the browser and stores it as channel data in Knock; FCM credentials are the Project ID and service-account JSON [9]. Knock's push overview lists no plain-VAPID or generic web-push provider [8].
- Novu lists FCM (with a separate integration for web), OneSignal, Pushpad, Pusher Beams and a Push Webhook [10]. A Push Webhook lets our own server do VAPID delivery and still use Novu's workflows.
- The FCM JS SDK needs a `firebase-messaging-sw.js` service worker, VAPID keys and HTTPS [23]. Firebase's page does not say whether Safari or iOS home-screen apps are supported.
- iOS/iPadOS 16.4+: Web Push works only for Home Screen web apps whose manifest sets `display` to `standalone` or `fullscreen`. The permission prompt must follow a direct user action. Delivery goes through Apple Push Notification service, so the server must allow `*.push.apple.com`. No Apple Developer Program membership is needed. The Badging API (`setAppBadge`) also works [11]. These rules hold for all three options. Cadence would need a web app manifest and a service worker whichever option wins.

### Email through Postmark

Both vendors take our existing Postmark server token. Knock also offers a delivery/bounce/spam webhook, per-channel sandbox mode, open and link tracking, and a payload override to choose a Postmark message stream (it uses the default `outbound` stream) [12]. Novu needs the server API token and a verified sender [13]. With either vendor, email templates move out of `app/lib/refund-emails.ts` into the vendor's templates, unless we pass rendered HTML in the payload.

### Preferences and mandatory Notifications

- Knock: unset preferences default to `true`. A send happens only if every applicable preference is true; a `false` category blocks even when the channel is true. A workflow can turn on "Override recipient preferences" to ignore preferences completely [15]. Per-kind maps to workflow or category; per-Channel maps to `channel_types`.
- Novu: preferences resolve per channel, and the most specific layer wins (subscriber per-workflow, then subscriber global, then workflow defaults). Workflows marked **critical** skip subscriber preferences and do not appear in the Preferences UI [16].
- Either vendor stores preferences on its side. The map's open question "Preferences model & UI" (vendor vs SQLite) depends on this.

### Workflows: delays, batching, digests

- Knock: Batch, Branch, Delay, Wait for event, Throttle, Trigger workflow, Fetch, AI agent, and data-update steps [17]. Its pricing page lists batching on every plan, including Free [1].
- Novu: Delay, Digest (regular or scheduled windows, keyed by subscriber plus an optional payload key) and Throttle. Maximum digest window is 1 day on Free, 7 on Pro, 30 on Team [18]. A daily "5 new questions today" digest fits within the Free 1-day limit.

### Local dev and the fallback transport

- Knock: no offline mode. Sandbox mode renders messages without delivering them and is not billed, but it does not cover the in-app channel, and it still calls Knock's API [19]. Workflows can live in the repo through the Knock CLI and sync to a branch per Git branch [19]. Tests and keyless dev need our own fake `notify()` adapter that writes to an outbox, like the mailer's `.outbox/`.
- Novu: `npx novu dev` tunnels Novu Cloud to a local Bridge Endpoint (`/api/novu`). Triggers still go through Novu Cloud, and a `bridgeUrl` override must be a public HTTPS URL [20]. As with Knock, offline tests need our own fake adapter.
- Build: the local transport is the same code with a different delivery adapter, so tests can exercise the real preference and Feed logic.

### Lock-in and migration cost

- Knock and Novu Cloud both hold workflow definitions, templates, preferences, recipient data and Feed history. Leaving means re-creating those and exporting Feed history through their APIs. The planned thin Cadence module (no vendor SDK outside it) limits the blast radius in server code. The prebuilt React Feed components do not: they are vendor-specific, and a switch means rewriting the Feed UI.
- Novu's code is MIT-licensed outside `enterprise/packages`, which has a proprietary licence for internal use only [21]. Self-hosting needs MongoDB, Redis and S3-compatible storage plus API, Worker and WS services (one VM with 4 vCPU and 8 GB at minimum) [22]. That conflicts with the one-SQLite-file stance in ADR 0006, so it works as an escape hatch, not a plan.

### Rough build effort for option 3 (estimate, not sourced)

Assuming the thin Cadence module, Drizzle migrations, and existing Postmark mailer:

| Piece | Rough effort |
| --- | --- |
| Schema: `notifications`, `notification_preferences`, `push_subscriptions` + migrations/seed | 0.5–1 day |
| `notify()` module: catalog of kinds, mandatory flag, preference check, fan-out to Channel adapters, outbox fallback | 1–2 days |
| Feed: loader + list UI, mark read/seen, unread badge rendered server-side | 1–2 days |
| Live updates: SSE resource route + in-process event emitter (single server process; more processes would need a broadcast layer) | 1 day |
| Web push: manifest, service worker, subscribe flow on user gesture, VAPID keys, `web-push` sender, pruning expired subscriptions (404/410) | 1.5–2 days |
| Preferences page (per kind × per Channel, mandatory locked on) | 1 day |
| Delays / digests: SQLite-backed job table + poller | 1.5–3 days, only if the catalog needs it |
| Tests across all of the above | woven in, +30–50% |

That totals roughly **7–12 developer-days** for parity with what Cadence needs, with no delivery analytics, template editor or retry dashboard. Ongoing cost: we own retries, push subscription churn, and iOS quirks.

## Open questions for the decision ticket

1. Expected Notification volume (messages vs runs changes which vendor is cheaper: Knock bills per Channel delivery, Novu per run).
2. How many Notification kinds in the first catalog? Novu Free caps at 5 workflows.
3. Does the unread badge need to be in the server-rendered HTML? Both vendor Feeds look client-only.
4. Are preferences allowed to live outside SQLite?
5. Is a vendor-specific Feed UI acceptable given the "one thin module" rule?

## Sources

Accessed 2026-11-10.

1. Knock pricing: https://knock.app/pricing
2. Novu pricing: https://novu.co/pricing
3. Novu pricing (Markdown version, FAQ on workflow runs and overage): https://novu.co/pricing.md
4. Knock plans and usage (what counts as a message): https://docs.knock.app/manage-your-account/knock-plans
5. Knock React feed: https://docs.knock.app/in-app-ui/react/feed
6. Knock in-app APIs and real-time service: https://docs.knock.app/in-app-ui/api-overview
7. Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
8. Knock push overview: https://docs.knock.app/integrations/push/overview
9. Knock FCM integration: https://docs.knock.app/integrations/push/firebase
10. Novu push integrations: https://docs.novu.co/platform/integrations/push
11. WebKit, "Web Push for Web Apps on iOS and iPadOS": https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
12. Knock Postmark integration: https://docs.knock.app/integrations/email/postmark
13. Novu Postmark integration: https://docs.novu.co/platform/integrations/email/postmark
14. Novu Remix quickstart: https://docs.novu.co/framework/quickstart/remix
15. Knock preferences overview: https://docs.knock.app/preferences/overview
16. Novu preferences: https://docs.novu.co/platform/concepts/preferences
17. Knock designing workflows: https://docs.knock.app/designing-workflows/overview
18. Novu digest step: https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest
19. Knock testing workflows and CLI: https://docs.knock.app/send-notifications/testing-workflows, https://docs.knock.app/developer-tools/knock-cli, https://docs.knock.app/tutorials/integrating-into-cicd
20. Novu Local Studio / Bridge Endpoint: https://docs.novu.co/framework/studio, https://docs.novu.co/framework/endpoint
21. Novu licence files: https://github.com/novuhq/novu/blob/next/LICENSE-ENTERPRISE, https://github.com/novuhq/novu/blob/next/EE-PACKAGES-LICENSE
22. Novu self-hosting overview: https://docs.novu.co/community/self-hosting-novu/overview
23. Firebase Cloud Messaging JS client setup: https://firebase.google.com/docs/cloud-messaging/js/client
