// PROTOTYPE — the FCM service worker, served at /firebase-messaging-sw.js
// (FCM requires it at the site root). Inlines Firebase's compat bundles from
// node_modules instead of a CDN, and injects the public config from .env.

import { readFileSync } from "node:fs";
import { firebaseClientConfig } from "~/lib/notify.prototype.server";

export function loader() {
  const config = firebaseClientConfig();
  if (!config) return new Response("// Firebase not configured", { status: 404 });
  const { vapidKey: _unused, ...firebaseConfig } = config;

  const app = readFileSync("node_modules/firebase/firebase-app-compat.js", "utf8");
  const messaging = readFileSync("node_modules/firebase/firebase-messaging-compat.js", "utf8");

  const body = `${app}
${messaging}

// Clicking a push opens its Cadence page. Registered before Firebase's own
// handler so it sees the click first.
self.addEventListener("notificationclick", (event) => {
  const msg = event.notification.data && event.notification.data.FCM_MSG;
  const url = (msg && msg.data && msg.data.url) || "/";
  event.notification.close();
  event.stopImmediatePropagation();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) { tab.navigate(url); return tab.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});

firebase.initializeApp(${JSON.stringify(firebaseConfig)});
const fcm = firebase.messaging();

// Log every background message so the prototype can show what Knock sent.
fcm.onBackgroundMessage((payload) => {
  console.log("[prototype push] background message", payload);
});
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}
