// PROTOTYPE — control panel for "How the Feed, push and email look"
// (toregu/cohort-005-project-one#7). Fires each v1 Notification at the
// signed-in user through Knock Development, turns on web push for this
// browser, and previews the Notification emails.

import { useEffect, useState } from "react";
import { data, useFetcher } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/prototype.notifications";
import { getCurrentUserId } from "~/lib/session";
import {
  NOTIFICATIONS,
  firebaseClientConfig,
  registerPushToken,
  triggerAsPrototype,
  type NotificationKind,
} from "~/lib/notify.prototype.server";
import {
  EMAIL_KINDS,
  brandedEmail,
  plainEmail,
} from "~/lib/notification-emails.prototype";

export async function loader() {
  return {
    notifications: NOTIFICATIONS,
    firebase: firebaseClientConfig(),
    emails: EMAIL_KINDS.map(({ kind, label }) => ({
      kind,
      label,
      plain: plainEmail(kind),
      light: brandedEmail(kind),
      dark: brandedEmail(kind, true),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel", { status: 401 });
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "trigger") {
      const kind = form.get("kind") as NotificationKind;
      const result = await triggerAsPrototype(kind, userId);
      return { ok: true, message: `Triggered ${kind} (run ${result.workflow_run_id})` };
    }
    if (intent === "push-token") {
      await registerPushToken(userId, String(form.get("token")));
      return { ok: true, message: "Push token saved to Knock" };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  return { ok: false, message: "Unknown intent" };
}

export default function PrototypeNotifications({ loaderData }: Route.ComponentProps) {
  const { notifications, firebase, emails } = loaderData;
  const fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (fetcher.data) {
      fetcher.data.ok ? toast.success(fetcher.data.message) : toast.error(fetcher.data.message);
    }
  }, [fetcher.data]);

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-600">Prototype</p>
        <h1 className="text-2xl font-bold">Notifications: Feed, push and email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fire any v1 Notification at yourself (whatever your role) through Knock Development. Flip the
          bell placement with the pink bar or ← →. Try dark mode from the sidebar.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">1. Feed: trigger a Notification</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {notifications.map((n) => {
            const knockable = n.channels.includes("F") || n.channels.includes("P");
            return (
              <fetcher.Form method="post" key={n.kind}>
                <input type="hidden" name="intent" value="trigger" />
                <input type="hidden" name="kind" value={n.kind} />
                <button
                  disabled={!knockable || fetcher.state !== "idle"}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium">{n.label}</span>
                    <span className="block text-xs text-muted-foreground">to {n.to}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{n.channels}</span>
                </button>
              </fetcher.Form>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">F = Feed, P = Push, E = Email. Purchase receipt is email-only, see section 3.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">2. Web push</h2>
        {firebase ? <PushPanel firebase={firebase} submit={fetcher.submit} /> : <p className="text-sm">Firebase isn't configured.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">3. Email (preview only)</h2>
        <div className="space-y-8">
          {emails.map((e) => (
            <div key={e.kind}>
              <h3 className="mb-1 font-medium">{e.label}</h3>
              <p className="mb-2 text-sm text-muted-foreground">Subject: {e.light.subject}</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {[
                  ["Plain (today)", e.plain.html],
                  ["Branded, light client", e.light.html],
                  ["Branded, dark client", e.dark.html],
                ].map(([label, html]) => (
                  <figure key={label}>
                    <figcaption className="mb-1 text-xs text-muted-foreground">{label}</figcaption>
                    <iframe title={label} srcDoc={html} className="h-96 w-full rounded-md border bg-white" />
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type FirebaseConfig = NonNullable<Route.ComponentProps["loaderData"]["firebase"]>;

function PushPanel({
  firebase,
  submit,
}: {
  firebase: FirebaseConfig;
  submit: ReturnType<typeof useFetcher>["submit"];
}) {
  const [status, setStatus] = useState<string>("unknown");
  const [last, setLast] = useState<unknown>(null);

  useEffect(() => {
    setStatus("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  async function enable() {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    const permission = await Notification.requestPermission();
    setStatus(permission);
    if (permission !== "granted") return;
    const { vapidKey, ...config } = firebase;
    const app = getApps()[0] ?? initializeApp(config);
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    submit({ intent: "push-token", token }, { method: "post" });
    // Tab open and focused: the browser shows nothing, so Cadence shows a toast.
    onMessage(messaging, (payload) => {
      setLast(payload);
      toast(payload.notification?.title ?? "Notification", {
        description: payload.notification?.body,
      });
    });
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        Permission: <span className="font-mono">{status}</span>
      </p>
      <button onClick={enable} className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">
        Turn on push for this browser
      </button>
      <p className="text-xs text-muted-foreground">
        Then trigger a Notification marked P above. Switch to another tab to see the OS notification; stay
        here to see the in-page toast.
      </p>
      {last != null && (
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(last, null, 2)}</pre>
      )}
    </div>
  );
}
