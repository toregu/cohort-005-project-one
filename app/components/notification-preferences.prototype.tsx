// PROTOTYPE — throwaway. Three variants of the Notifications section on /settings.
// "Three variants of the notification preferences, switchable via ?variant=A|B|C,
//  on the existing /settings route." State is in memory; nothing talks to Knock.
import { useState } from "react";
import { Lock, BellRing, BellOff, Ban, MonitorSmartphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

type Channel = "push" | "feed" | "email";
const CHANNELS: { key: Channel; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "feed", label: "Feed" },
  { key: "email", label: "Email" },
];

type Audience = "buyer" | "commenter" | "instructor" | "teamAdmin" | "platformAdmin";

type NotificationType = {
  key: string;
  title: string;
  description: string;
  group: string;
  audience: Audience;
  channels: Channel[];
  mandatory: Partial<Record<Channel, string>>;
};

const CATALOG: NotificationType[] = [
  {
    key: "refund-approved",
    title: "Refund approved",
    description: "A Platform Admin approved your Refund Request.",
    group: "Purchases & refunds",
    audience: "buyer",
    channels: ["push", "feed", "email"],
    mandatory: { email: "We always email you when money moves or access ends." },
  },
  {
    key: "refund-declined",
    title: "Refund declined",
    description: "A Platform Admin declined your Refund Request.",
    group: "Purchases & refunds",
    audience: "buyer",
    channels: ["push", "feed", "email"],
    mandatory: { email: "We always email you the outcome of a Refund Request." },
  },
  {
    key: "purchase-receipt",
    title: "Purchase receipt",
    description: "Your receipt after buying a course.",
    group: "Purchases & refunds",
    audience: "buyer",
    channels: ["email"],
    mandatory: { email: "Receipts are always emailed." },
  },
  {
    key: "comment-replied",
    title: "Reply to your Comment",
    description: "Someone replied to a Comment you posted on a lesson.",
    group: "Comments",
    audience: "commenter",
    channels: ["push", "feed"],
    mandatory: {},
  },
  {
    key: "comment-posted",
    title: "New Comment on your course",
    description: "A Student posted a new Comment on one of your lessons.",
    group: "Your courses",
    audience: "instructor",
    channels: ["push", "feed"],
    mandatory: {},
  },
  {
    key: "enrollment-created",
    title: "New Enrollment",
    description: "Someone enrolled in one of your courses.",
    group: "Your courses",
    audience: "instructor",
    channels: ["feed"],
    mandatory: {},
  },
  {
    key: "seat-claimed",
    title: "Seat claimed",
    description: "Someone claimed a Seat on your Team Licence.",
    group: "Your team",
    audience: "teamAdmin",
    channels: ["feed"],
    mandatory: {},
  },
  {
    key: "refund-request-opened",
    title: "New Open Refund Request",
    description: "A buyer raised a Refund Request that needs deciding.",
    group: "Platform",
    audience: "platformAdmin",
    channels: ["feed", "email"],
    mandatory: { feed: "Every Platform Admin sees new Refund Requests in the Feed." },
  },
];

export type PreferencesViewer = {
  role: "student" | "instructor" | "admin";
  isTeamAdmin: boolean;
};

function visibleTypes(viewer: PreferencesViewer) {
  const audiences = new Set<Audience>();
  if (viewer.role === "admin") {
    audiences.add("platformAdmin");
  } else {
    audiences.add("buyer");
    audiences.add("commenter");
    if (viewer.role === "instructor") audiences.add("instructor");
    if (viewer.isTeamAdmin) audiences.add("teamAdmin");
  }
  return CATALOG.filter((type) => audiences.has(type.audience));
}

type DeviceState = "on" | "off" | "blocked" | "unsupported";
type Prefs = Record<string, Partial<Record<Channel, boolean>>>;

function initialPrefs(): Prefs {
  const prefs: Prefs = {};
  for (const type of CATALOG) {
    prefs[type.key] = {};
    for (const channel of type.channels) prefs[type.key][channel] = true;
  }
  return prefs;
}

function usePrototypeState() {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [device, setDevice] = useState<DeviceState>("off");
  function toggle(typeKey: string, channel: Channel) {
    setPrefs((current) => ({
      ...current,
      [typeKey]: { ...current[typeKey], [channel]: !current[typeKey][channel] },
    }));
  }
  function setChannelForAll(types: NotificationType[], channel: Channel, value: boolean) {
    setPrefs((current) => {
      const next = { ...current };
      for (const type of types) {
        if (!type.channels.includes(channel) || type.mandatory[channel]) continue;
        next[type.key] = { ...next[type.key], [channel]: value };
      }
      return next;
    });
  }
  return { prefs, toggle, setChannelForAll, device, setDevice };
}

// ─── Shared bits (small on purpose) ───

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function LockedMark({ reason }: { reason: string }) {
  return (
    <span title={reason} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3.5" /> Always on
    </span>
  );
}

const DEVICE_COPY: Record<DeviceState, { title: string; body: string }> = {
  on: {
    title: "Push is on for this device",
    body: "This browser gets push for the Notifications you've left on below.",
  },
  off: {
    title: "Push is off for this device",
    body: "Turn it on to get push in this browser. Other devices keep their own setting.",
  },
  blocked: {
    title: "Your browser has blocked push for Cadence",
    body: "Click the lock icon next to the address bar, allow Notifications for this site, then reload.",
  },
  unsupported: {
    title: "Push isn't supported on this browser",
    body: "On iPhone or iPad, add Cadence to your Home Screen (Share → Add to Home Screen) and open it from there.",
  },
};

function DeviceSwitch({
  device,
  setDevice,
  compact,
}: {
  device: DeviceState;
  setDevice: (state: DeviceState) => void;
  compact?: boolean;
}) {
  const copy = DEVICE_COPY[device];
  const Icon =
    device === "on" ? BellRing : device === "off" ? BellOff : device === "blocked" ? Ban : MonitorSmartphone;
  return (
    <div className={`flex items-start gap-3 ${compact ? "" : "rounded-md border p-3"}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-xs text-muted-foreground">{copy.body}</p>
      </div>
      {(device === "on" || device === "off") && (
        <Toggle
          label="Push on this device"
          checked={device === "on"}
          onChange={() => setDevice(device === "on" ? "off" : "on")}
        />
      )}
    </div>
  );
}

/** Prototype-only: lets you see all four device states without a real browser. */
function SimulateDevice({
  device,
  setDevice,
}: {
  device: DeviceState;
  setDevice: (state: DeviceState) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-fuchsia-500 p-2 text-xs">
      <span className="font-mono text-fuchsia-600">PROTOTYPE · simulate this device:</span>
      {(["on", "off", "blocked", "unsupported"] as DeviceState[]).map((state) => (
        <button
          key={state}
          type="button"
          onClick={() => setDevice(state)}
          className={`rounded px-2 py-0.5 ${device === state ? "bg-fuchsia-600 text-white" : "bg-muted"}`}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

function groupBy(types: NotificationType[]) {
  const groups = new Map<string, NotificationType[]>();
  for (const type of types) {
    groups.set(type.group, [...(groups.get(type.group) ?? []), type]);
  }
  return [...groups.entries()];
}

// ─── Variant A: one matrix (rows = Notifications, columns = Channels) ───

export function VariantA({ viewer }: { viewer: PreferencesViewer }) {
  const { prefs, toggle, device, setDevice } = usePrototypeState();
  const types = visibleTypes(viewer);
  return (
    <Card className="mt-8 max-w-3xl">
      <CardHeader>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose how Cadence reaches you about each kind of Notification.
        </p>
      </CardHeader>
      <CardContent>
        <SimulateDevice device={device} setDevice={setDevice} />
        <DeviceSwitch device={device} setDevice={setDevice} />
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-medium">Notification</th>
              {CHANNELS.map((channel) => (
                <th key={channel.key} className="w-24 py-2 text-center font-medium">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          {groupBy(types).map(([group, groupTypes]) => (
            <tbody key={group}>
              <tr>
                <td colSpan={4} className="pb-1 pt-4 text-xs font-semibold text-muted-foreground">
                  {group}
                </td>
              </tr>
              {groupTypes.map((type) => (
                <tr key={type.key} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{type.title}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </td>
                  {CHANNELS.map((channel) => {
                    if (!type.channels.includes(channel.key)) {
                      return (
                        <td key={channel.key} className="text-center text-muted-foreground/50">
                          —
                        </td>
                      );
                    }
                    const locked = type.mandatory[channel.key];
                    const pushDimmed = channel.key === "push" && device !== "on";
                    return (
                      <td key={channel.key} className={`text-center ${pushDimmed ? "opacity-40" : ""}`}>
                        {locked ? (
                          <span title={locked}>
                            <Lock className="mx-auto size-4 text-muted-foreground" />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={prefs[type.key][channel.key] ?? false}
                            onChange={() => toggle(type.key, channel.key)}
                            aria-label={`${type.title} by ${channel.label}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Locked Channels can't be turned off. Hover for why.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Variant B: one card per Channel, Notifications listed inside ───

export function VariantB({ viewer }: { viewer: PreferencesViewer }) {
  const { prefs, toggle, setChannelForAll, device, setDevice } = usePrototypeState();
  const types = visibleTypes(viewer);
  const blurbs: Record<Channel, string> = {
    push: "Pop-ups from your browser or phone, even when Cadence isn't open.",
    feed: "The bell in the sidebar. Everything lands here unless you turn it off.",
    email: "Sent to your account's email address.",
  };
  return (
    <div className="mt-8 max-w-5xl">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="mb-4 text-sm text-muted-foreground">Pick a Channel, then what it tells you about.</p>
      <SimulateDevice device={device} setDevice={setDevice} />
      <div className="grid gap-4 md:grid-cols-3">
        {CHANNELS.map((channel) => {
          const channelTypes = types.filter((type) => type.channels.includes(channel.key));
          if (channelTypes.length === 0) return null;
          const muted = channel.key === "push" && device !== "on";
          return (
            <Card key={channel.key}>
              <CardHeader>
                <h3 className="font-semibold">{channel.label}</h3>
                <p className="text-xs text-muted-foreground">{blurbs[channel.key]}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {channel.key === "push" && (
                  <div className="border-b pb-3">
                    <DeviceSwitch device={device} setDevice={setDevice} compact />
                  </div>
                )}
                <div className={`space-y-3 ${muted ? "opacity-40" : ""}`}>
                  {channelTypes.map((type) => {
                    const locked = type.mandatory[channel.key];
                    return (
                      <div key={type.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm">{type.title}</span>
                        {locked ? (
                          <LockedMark reason={locked} />
                        ) : (
                          <Toggle
                            label={`${type.title} by ${channel.label}`}
                            checked={prefs[type.key][channel.key] ?? false}
                            onChange={() => toggle(type.key, channel.key)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setChannelForAll(channelTypes, channel.key, true)}>
                    All on
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setChannelForAll(channelTypes, channel.key, false)}>
                    All off
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Variant C: a list of Notifications, each with Channel chips ───

export function VariantC({ viewer }: { viewer: PreferencesViewer }) {
  const { prefs, toggle, device, setDevice } = usePrototypeState();
  const types = visibleTypes(viewer);
  return (
    <section className="mt-8 max-w-2xl">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Tap a Channel to turn it on or off for that Notification.</p>
        </div>
      </div>
      <SimulateDevice device={device} setDevice={setDevice} />
      <div
        className={`mb-6 rounded-lg p-4 ${
          device === "on"
            ? "bg-primary/10"
            : device === "off"
              ? "bg-amber-100 dark:bg-amber-900/30"
              : "bg-muted"
        }`}
      >
        <DeviceSwitch device={device} setDevice={setDevice} compact />
      </div>
      <ul className="divide-y rounded-lg border">
        {types.map((type) => (
          <li key={type.key} className="p-4">
            <p className="font-medium">{type.title}</p>
            <p className="mb-3 text-sm text-muted-foreground">{type.description}</p>
            <div className="flex flex-wrap gap-2">
              {type.channels.map((channel) => {
                const label = CHANNELS.find((c) => c.key === channel)!.label;
                const locked = type.mandatory[channel];
                const on = locked ? true : (prefs[type.key][channel] ?? false);
                const pushOff = channel === "push" && device !== "on";
                return (
                  <button
                    key={channel}
                    type="button"
                    disabled={!!locked}
                    title={locked ?? (pushOff ? "Push is off on this device" : undefined)}
                    onClick={() => toggle(type.key, channel)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground line-through"
                    } ${locked ? "cursor-not-allowed" : ""} ${pushOff && on ? "opacity-50" : ""}`}
                  >
                    {locked && <Lock className="size-3" />}
                    {label}
                  </button>
                );
              })}
            </div>
            {Object.values(type.mandatory).map((reason) => (
              <p key={reason} className="mt-2 text-xs text-muted-foreground">
                {reason}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export const PREFERENCE_VARIANTS = [
  { key: "A", name: "Matrix", Component: VariantA },
  { key: "B", name: "Card per Channel", Component: VariantB },
  { key: "C", name: "List with Channel chips", Component: VariantC },
];
