# How web push works for a React Router app

Research for [#4](https://github.com/toregu/cohort-005-project-one/issues/4), part of map [#2](https://github.com/toregu/cohort-005-project-one/issues/2).

**Question:** What does it take to send web push to a Cadence user's phone from a React Router 8 app, whichever orchestrator we choose?

Researched 2026-11-10 against primary sources (MDN, WebKit, web.dev, Chrome for Developers, Firebase, the `web-push` README, Knock and Novu docs). Each claim cites its source. Anything marked *(inference)* is a reasoned step that no single source states.

## TL;DR

- Web push uses only open standards: a **service worker**, the **Push API** (`PushManager.subscribe`), and the **Web Push Protocol with VAPID**. A server POSTs an encrypted, VAPID-signed message to the subscription's `endpoint` URL. The browser vendor's push service, such as FCM for Chrome or APNs for Safari, delivers it.
- **Firebase is not needed.** A VAPID key pair plus the `web-push` npm library reaches every browser, including Chrome, whose endpoints are on `fcm.googleapis.com`. Firebase becomes necessary only if an orchestrator's web push path goes through FCM, which is the case for **Knock**. FCM is free either way.
- **iOS/iPadOS 16.4+ only, and only for a web app the user has added to the Home Screen.** The site needs a manifest with `display: standalone` or `fullscreen`. Permission must be requested from a user gesture. Android Chrome and desktop browsers work in an ordinary tab.
- **Storage:** keep one row per subscription (`endpoint`, `p256dh`, `auth`) linked to a user, so one person can have many devices. Delete the row when the push service returns **404 or 410**. Handle `pushsubscriptionchange` in the service worker.
- **Orchestrators:** Knock has **no first-party web push channel** and uses FCM tokens. Novu has no native VAPID channel either. It offers FCM, or a **Push Webhook** that POSTs to our own endpoint, which would then send with `web-push`.

## 1. The flow end to end

1. **Feature-detect** `'serviceWorker' in navigator && 'PushManager' in window`, and hide the push UI if either is missing. [web.dev: Subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user)
2. **Register a service worker**, for example `navigator.serviceWorker.register('/sw.js')`. A push subscription requires an active service worker. [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
3. **Ask for permission** with `Notification.requestPermission()` in response to a user gesture. See section 4.
4. **Subscribe:** `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID public key> })`.
   - `applicationServerKey` is "an ECDSA P-256 public key that the push server will use to authenticate your application server. If specified, all messages from your application server must use the VAPID authentication scheme."
   - Chrome and Edge reject the subscribe call unless `userVisibleOnly` is `true`.
   - Push is available only in secure contexts (HTTPS).
   - Source: [MDN: PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
5. **Send the subscription to the server.** The browser returns a `PushSubscription` containing `endpoint` and `keys.p256dh` / `keys.auth`. POST its JSON to an action and store it. [web.dev: Subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user)
   - MDN warns that "the endpoint URL therefore needs to be kept secret," and that CSRF protection is "vitally important." [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
6. **Send from the server** with `webpush.sendNotification(subscription, payload, { TTL, urgency, topic })`. [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
7. **Receive in the service worker.** A `push` event fires "whether or not the web app is in the foreground, or even currently loaded." The handler calls `registration.showNotification(...)` inside `event.waitUntil`. A `notificationclick` handler opens or focuses the right URL. [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### React Router 8 specifics *(inference)*

React Router has no built-in service worker support. Here is the minimal shape:

- Put a hand-written `public/sw.js` in the app. Vite copies `public/` as-is, so it is served at `/sw.js` with root scope. The repo's `public/` currently holds only a favicon and images.
- Add `public/manifest.webmanifest` and link it from `app/root.tsx`. iOS requires the manifest (see section 3).
- Register the service worker from a client-only `useEffect` in `root.tsx`. SSR never touches `navigator`.
- Add a resource route action such as `POST /api/push-subscriptions` to upsert or delete subscriptions. It is protected by the session, like other actions.
- Add a server module such as `app/lib/push.server.ts` that wraps `web-push` and holds the VAPID keys from env. This fits the map's "one thin Cadence module" rule, and gives the local fallback transport an obvious seam: write to `.outbox/` instead of sending.
- Payload size: push services must accept at least 4096 bytes. [web.dev: Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol) Send a small payload with title, body and URL, and let the Feed carry the detail.

## 2. VAPID with `web-push` vs FCM: is Firebase needed?

**No.** VAPID made Firebase optional for web push:

- Chrome's own guidance: "With VAPID you no longer need a Firebase project, a `gcm_sender_id`, or an `Authorization` header." [Chrome for Developers: Web push interop wins](https://developer.chrome.com/blog/web-push-interop-wins)
- Chrome subscriptions still have endpoints on `fcm.googleapis.com`. The guidance is to speak the standard Web Push Protocol to them, not FCM's API, "so your server code works with any push service." [Chrome for Developers](https://developer.chrome.com/blog/web-push-interop-wins)
- Only legacy browsers needed `gcm_sender_id`: Chrome 51 and earlier, Opera for Android, and older Samsung Internet. [Chrome for Developers](https://developer.chrome.com/blog/web-push-interop-wins), [web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- "All push services use the same API (the web push protocol)", so the sender doesn't need to care which service is behind an endpoint. [web.dev: Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol)

**The `web-push` library** (Node) [README](https://github.com/web-push-libs/web-push/blob/master/README.md):

- `webpush.generateVAPIDKeys()` runs once. "Create these keys once, store them and use them for all future messages."
- `webpush.setVapidDetails(subject, publicKey, privateKey)`. The `subject` must be a real `mailto:` or `https:` URI. The README warns that Apple Push may reject localhost-style subjects with `403 BadJwtToken`.
- `sendNotification` options: `TTL` (default four weeks), `urgency` (`very-low` | `low` | `normal` | `high`), `topic` (collapses pending messages), and `timeout`. It resolves or rejects with the push service's `statusCode`, `headers` and `body`.

**What the FCM route costs instead:**

- A Firebase project.
- The `firebase` JS SDK on the client, with a `firebase-messaging-sw.js` service worker at the domain root. [Firebase: JS client](https://firebase.google.com/docs/cloud-messaging/js/client)
- VAPID keys generated in the Firebase console. The client gets an FCM token or installation ID rather than a raw `PushSubscription`. [Firebase: JS client](https://firebase.google.com/docs/cloud-messaging/js/client)
- Server sends through HTTP v1, `POST https://fcm.googleapis.com/v1/projects/{id}/messages:send`, with an OAuth2 token minted from a service account. [Firebase: HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- FCM is listed as a no-cost product. [Firebase pricing](https://firebase.google.com/pricing)

The FCM route adds an SDK, a Google project and service account credentials, and a second abstraction over the same browser push services. It is worth it only if an orchestrator requires FCM tokens.

## 3. iOS/iPadOS and Android

**iOS/iPadOS** [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/):

- Requires iOS/iPadOS **16.4+**, and only for **Home Screen web apps**. The site needs a web app manifest with `display` set to `standalone` or `fullscreen`, and the user must add it to the Home Screen via Share. Ordinary Safari tabs on iPhone do not get push.
- The permission request must be "in response to direct user interaction", such as tapping a subscribe button.
- Delivery goes through the Apple Push Notification service. **No Apple Developer Program membership is needed.** Allow `*.push.apple.com` if outbound traffic is restricted.
- It is standards-based Web Push, the same as Safari on macOS. Use feature detection, not browser sniffing.
- Notifications appear on the Lock Screen, in Notification Center, and on a paired Apple Watch, and they respect Focus.
- **Declarative Web Push** shipped in iOS/iPadOS 18.4. The push message JSON itself describes the notification, so no service worker is needed to display it, and it is "backwards compatible with existing Web Push notifications." [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) It is an option, not a requirement. The post does not say it lifts the Home Screen requirement on iPhone.
- **Product implication *(inference)*:** iPhone Students must install Cadence to the Home Screen before push can work. The opt-in UI should detect iOS without standalone mode and show "Add to Home Screen" instructions rather than a dead button. Knock's FCM tutorial notes the same requirement. [Knock tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)

**Android:**

- Chrome on Android supports push from a normal browser tab. No install is needed. (General platform behaviour. MDN marks `PushManager.subscribe` as Baseline "widely available since March 2023". [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe))
- Endpoints are on `fcm.googleapis.com`, and VAPID works as above.
- Installing the app as a PWA is optional on Android.

## 4. Permission-prompt UX

- **Never prompt on page load.** "The worst thing you can do is to show the permission dialog to users as soon as they land on your site." [web.dev: Permission UX](https://web.dev/articles/push-notifications-permissions-ux)
- **A denial is effectively permanent.** "If the user blocks the permission request, your web app can't ask for permission again." Recovering requires browser settings. [web.dev: Permission UX](https://web.dev/articles/push-notifications-permissions-ux)
- **Use a double permission.** Show our own in-page explanation first, and trigger the browser prompt only if the user opts in. Ask when the value is obvious. [web.dev: Permission UX](https://web.dev/articles/push-notifications-permissions-ux) For Cadence, that could be right after a Student requests a refund ("get notified when it's decided"), or from a toggle on the notification-preferences page.
- **Tie the prompt to a user gesture.** Firefox 72+ already enforces this, other browsers are moving that way, and iOS requires it. [MDN: subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- **Provide an off switch.** Users who can't find one are more likely to block. [web.dev: Permission UX](https://web.dev/articles/push-notifications-permissions-ux) This lines up with the map's per-kind, per-Channel preferences.
- **Every push must show a notification** (`userVisibleOnly`), so there is no silent push for syncing the Feed. [MDN: subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [web.dev: Subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user)

## 5. Storing subscriptions and handling expiry

**Shape** *(inference from the subscription format)*: a `push_subscriptions` table in the SQLite DB via Drizzle.

| column | notes |
| --- | --- |
| `id` | PK |
| `user_id` | FK to users; one user has many rows (phone, laptop, tablet) |
| `endpoint` | **unique**; the natural key, so re-subscribing on the same device upserts |
| `p256dh`, `auth` | encryption keys from `subscription.keys`; required for payloads ([web-push README](https://github.com/web-push-libs/web-push/blob/master/README.md)) |
| `user_agent` / label | optional, for a "your devices" list |
| `created_at`, `last_success_at` | for housekeeping |

**Lifecycle:**

- **Send:** fan out to every row for the recipient. Knock does the same, trying "each unique token". [Knock FCM](https://docs.knock.app/integrations/push/firebase)
- **404 or 410 from the push service:** the subscription is expired or gone. Delete the row; the client must resubscribe. [web.dev: Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol)
- **413** means the payload is too large. **429** means rate limited; honour `Retry-After`. [web.dev: Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol)
- **`pushsubscriptionchange`** fires in the service worker when a subscription "has been invalidated, or is about to be invalidated." Resubscribe there and POST the new subscription, replacing the old endpoint. [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- **On every app load** *(inference)*, call `pushManager.getSubscription()` and re-POST it if permission is granted. The upsert by endpoint keeps the server in sync cheaply and also repairs missed change events.
- **Logout or account switch** *(inference)*: delete or reassign the row for that endpoint. Otherwise a shared device keeps receiving the previous user's notifications.
- **Don't send keep-alive pushes** to stop subscriptions expiring. [web.dev: Subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user)

## 6. How Knock and Novu handle web push

**Knock**

- "**Knock does not have a first-party web push channel.**" Web push goes through Knock's FCM channel. [Knock tutorial: Sending web push with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)
- Setup:
  - Create a Firebase project and VAPID key in the Firebase console.
  - Add the `firebase` SDK and `firebase-messaging-sw.js`.
  - Call `getToken({ vapidKey, serviceWorkerRegistration })`.
  - Store the token with `knock.user.setChannelData(fcmChannelId, { tokens: [token] })`.
- Knock stores a `tokens` array (or `devices` with metadata) per user per channel, and sends to each token. [Knock FCM](https://docs.knock.app/integrations/push/firebase)
- With **token deregistration**, Knock can remove an invalid token after a bounce. [Knock push overview](https://docs.knock.app/integrations/push/overview)
- Supported push providers: APNs, FCM, Expo, OneSignal, Amazon SNS. VAPID is not listed. [Knock push overview](https://docs.knock.app/integrations/push/overview)
- **Implication:** choosing Knock means using FCM for web push. That brings a Firebase project (free) and the Firebase SDK on the client. Subscription storage lives in Knock, not SQLite.

**Novu**

- Push providers: FCM, Expo, APNs, OneSignal, **Push Webhook**, Pusher Beams, Pushpad. There is no native VAPID provider; the web example uses FCM. [Novu push integrations](https://docs.novu.co/platform/integrations/push)
- Tokens are stored as `deviceTokens` on the subscriber's `channels[]`, per integration, up to 100 per subscriber channel. Updating replaces the array, so merge client-side. Novu auto-removes stale tokens only for FCM and Expo. [Novu push integrations](https://docs.novu.co/platform/integrations/push)
- **Push Webhook:** Novu POSTs `{ target: [token], title, content, payload, ... }` to our URL, signed with an HMAC in `x-novu-signature`. [Novu Push Webhook](https://docs.novu.co/platform/integrations/push/push-webhook)
  - *(inference)* A Cadence endpoint could verify the signature, look up the user's `push_subscriptions` rows, and send with `web-push` and VAPID. That keeps Firebase out entirely and keeps subscriptions in SQLite.
  - The catch: Novu would see an opaque token, so 404/410 cleanup stays our job.
- **Implication:** Novu can do web push via FCM (like Knock), or via a webhook to our own VAPID sender.

**Built ourselves:** `web-push` plus VAPID plus the SQLite table above. No Firebase at all. The map's note that "Firebase means FCM for push only" becomes moot for web push.

## 7. Open points for downstream tickets

- How each orchestrator uses push is in section 6. The comparison ticket (#6) should weigh Knock's mandatory FCM against Novu's webhook option and the built-ourselves `web-push` route.
- "Dev account setup" on the map: VAPID keys need generating once and storing as secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:...`). The FCM route needs a Firebase project and service account instead.
- Local dev: `localhost` counts as a secure context. Testing on an iPhone needs an HTTPS tunnel and a Home Screen install. The fallback transport can write pushes to `.outbox/` like the mailer.

## Sources

- MDN: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [PushManager.subscribe()](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- WebKit: [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)
- web.dev: [Subscribing a user](https://web.dev/articles/push-notifications-subscribing-a-user), [Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol), [Permission UX](https://web.dev/articles/push-notifications-permissions-ux)
- Chrome for Developers: [Web push interoperability wins](https://developer.chrome.com/blog/web-push-interop-wins)
- Firebase: [FCM JS client](https://firebase.google.com/docs/cloud-messaging/js/client), [HTTP v1 send](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Pricing](https://firebase.google.com/pricing)
- [`web-push` README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- Knock: [Push overview](https://docs.knock.app/integrations/push/overview), [FCM integration](https://docs.knock.app/integrations/push/firebase), [Tutorial: web push with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)
- Novu: [Push integrations](https://docs.novu.co/platform/integrations/push), [Push Webhook](https://docs.novu.co/platform/integrations/push/push-webhook)
