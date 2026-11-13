// PROTOTYPE — throwaway. Where the bell sits and how the Knock Feed looks in
// Cadence (toregu/cohort-005-project-one#7). Three variants, picked with
// ?variant= on any app page:
//   A  Bell in the sidebar's top strip, popover opens to the right
//   B  "Notifications" sidebar nav item with an unread count, full Feed page
//   C  New slim top bar over the page, bell at the right, popover + "See all"

import "@knocklabs/react/dist/index.css";
import "~/knock-theme.prototype.css";
import {
  FilterStatus,
  KnockFeedProvider,
  KnockProvider,
  NotificationFeed,
  NotificationFeedPopover,
  NotificationIconButton,
  useKnockFeed,
  type NotificationCellProps,
} from "@knocklabs/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";

export type KnockConfig = {
  publicKey: string;
  feedId: string;
  userId: string;
  userToken: string;
};

const Ready = createContext(false);

export function NotificationsProvider({
  config,
  children,
}: {
  config: KnockConfig | null;
  children: React.ReactNode;
}) {
  // Knock's Feed is client-only (decided in "Choose Knock, Novu, or build it
  // ourselves"), so mount it after hydration; the badge appears a beat late.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!config || !mounted) return <>{children}</>;

  return (
    <KnockProvider
      apiKey={config.publicKey}
      user={{ id: config.userId }}
      userToken={config.userToken}
    >
      {/* Always "light": Cadence tokens do the dark mode, see knock-theme.prototype.css */}
      <KnockFeedProvider feedId={config.feedId} colorMode="light">
        <Ready.Provider value={true}>{children}</Ready.Provider>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function actionUrl(item: Parameters<NonNullable<NotificationCellProps["onItemClick"]>>[0]) {
  for (const block of item.blocks) {
    if (block.name === "action_url" && "rendered" in block) return block.rendered;
  }
  return undefined;
}

function useOpenItem(onDone?: () => void) {
  const navigate = useNavigate();
  const { feedClient } = useKnockFeed();
  return (item: Parameters<NonNullable<NotificationCellProps["onItemClick"]>>[0]) => {
    feedClient.markAsRead(item);
    const url = actionUrl(item);
    onDone?.();
    if (url) navigate(url);
  };
}

function Popover({
  placement,
  showSeeAll,
}: {
  placement: "right-start" | "bottom-end";
  showSeeAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openItem = useOpenItem(() => setOpen(false));
  const navigate = useNavigate();

  return (
    <>
      <NotificationIconButton ref={buttonRef} onClick={() => setOpen(!open)} />
      <NotificationFeedPopover
        buttonRef={buttonRef}
        isVisible={open}
        onClose={() => setOpen(false)}
        placement={placement}
        onNotificationClick={openItem}
        renderHeader={
          showSeeAll
            ? ({ filterStatus, setFilterStatus }) => (
                <div className="flex h-11 items-center justify-between border-b px-4 text-sm">
                  <span className="font-semibold">Notifications</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <button
                      onClick={() =>
                        setFilterStatus(
                          filterStatus === FilterStatus.Unread ? FilterStatus.All : FilterStatus.Unread
                        )
                      }
                      className="hover:text-foreground"
                    >
                      {filterStatus === FilterStatus.Unread ? "Show all" : "Unread only"}
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate("/notifications");
                      }}
                      className="font-medium text-foreground hover:underline"
                    >
                      See all
                    </button>
                  </div>
                </div>
              )
            : undefined
        }
      />
    </>
  );
}

// Variant A — in the sidebar's top strip next to the wordmark.
export function SidebarStripBell() {
  if (!useContext(Ready)) return <Bell className="size-4 opacity-30" />;
  return <Popover placement="right-start" />;
}

// Variant B — a sidebar nav row with a count, linking to the Feed page.
export function FeedNavItem() {
  const ready = useContext(Ready);
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      {ready && <UnreadCount />}
    </NavLink>
  );
}

function UnreadCount() {
  const { useFeedStore } = useKnockFeed();
  const unread = useFeedStore((s) => s.metadata.unread_count);
  if (!unread) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

// Variant C — a slim bar across the top of <main>.
export function TopBar() {
  const ready = useContext(Ready);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b bg-background/80 px-6 backdrop-blur">
      {ready ? <Popover placement="bottom-end" showSeeAll /> : <Bell className="size-4 opacity-30" />}
    </div>
  );
}

// The full Feed page (variants B and C; in A there is no page).
export function FeedPage() {
  const ready = useContext(Ready);
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Notifications</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Everything Cadence has told you, newest first.
      </p>
      <div className="cadence-feed-page h-[70vh] overflow-hidden rounded-lg border">
        {ready ? <FeedPageInner /> : <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
      </div>
    </div>
  );
}

function FeedPageInner() {
  const openItem = useOpenItem();
  return <NotificationFeed onNotificationClick={openItem} />;
}
