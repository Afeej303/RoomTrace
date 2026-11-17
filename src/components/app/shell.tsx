import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Cpu,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaySquare,
  Radar,
  Settings,
} from "lucide-react";
import { authClient } from "@/lib/auth";
import { roomsQuery } from "@/lib/data";
import { useLive } from "@/lib/radar/live";
import { EVENT_LABELS } from "@/lib/radar/types";
import { Logo } from "./logo";
import { Pill, SimTag, timeAgo } from "./status";
import { EventRow } from "./event-row";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const GROUPS: { label: string; items: { to: string; label: string; icon: typeof Radar }[] }[] = [
  {
    label: "Monitor",
    items: [
      { to: "/overview", label: "Overview", icon: LayoutDashboard },
      { to: "/live", label: "Live Monitoring", icon: Activity },
      { to: "/radar", label: "Radar Visualization", icon: Radar },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/rooms", label: "Rooms", icon: Boxes },
      { to: "/devices", label: "Devices & Sensors", icon: Cpu },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/events", label: "Event History", icon: History },
      { to: "/playback", label: "Route Playback", icon: PlaySquare },
    ],
  },
  { label: "System", items: [{ to: "/settings", label: "Settings", icon: Settings }] },
];

const FLAT = GROUPS.flatMap((g) => g.items);

function useUserEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void authClient.getUser().then((user) => setEmail(user?.email ?? null));
  }, []);
  return email;
}

function ConnectionStatus() {
  const { mode, streamStatus, simStatus } = useLive();
  if (mode === "simulation")
    return (
      <Pill t={simStatus === "running" ? "primary" : "neutral"} pulse={simStatus === "running"}>
        Simulation {simStatus}
      </Pill>
    );
  const m = {
    live: ["success", "Realtime connected"],
    connecting: ["warning", "Connecting…"],
    offline: ["error", "Realtime offline"],
    simulated: ["neutral", "—"],
  } as const;
  const [t, l] = m[streamStatus];
  return (
    <Pill t={t} pulse={streamStatus === "live"}>
      {l}
    </Pill>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const email = useUserEmail();
  const { pathname } = useLocation();
  return (
    <div className="flex h-full flex-col">
      <Link to="/overview" onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-5">
        <Logo />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">RoomTrace</div>
          <div className="text-[11px] text-muted-foreground">Camera-free awareness</div>
        </div>
      </Link>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className={cn("size-4", active ? "text-primary" : "")} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Status</span>
          <ConnectionStatus />
        </div>
        <Link
          to="/settings"
          hash="system"
          onClick={onNavigate}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="size-4" /> Help & system info
        </Link>
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/60 p-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
            {email?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1 truncate text-xs">{email ?? "…"}</div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const email = useUserEmail();
  const { data: rooms = [] } = useQuery(roomsQuery);
  const live = useLive();
  const current = FLAT.find((n) => pathname.startsWith(n.to));
  const [seen, setSeen] = useState(0);
  const unread = live.liveEvents.filter((e) => e.timestamp > seen).length;
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-2 text-sm sm:flex"
          >
            <span className="text-muted-foreground">RoomTrace</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium">{current?.label ?? "Dashboard"}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {rooms.length > 0 && (
              <Select value={live.selectedRoomId ?? ""} onValueChange={live.setSelectedRoomId}>
                <SelectTrigger className="h-9 w-36 bg-card sm:w-44" aria-label="Current room">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div
              className="hidden items-center gap-0.5 rounded-lg border bg-muted p-0.5 sm:inline-flex"
              role="group"
              aria-label="Data source"
            >
              {(["simulation", "hardware"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => live.setMode(m)}
                  aria-pressed={live.mode === m}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] font-semibold tracking-wider transition-colors",
                    live.mode === m
                      ? m === "simulation"
                        ? "bg-sim-soft text-sim shadow-card"
                        : "bg-success/15 text-success shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      m === "simulation" ? "bg-sim" : "bg-success",
                    )}
                  />
                  {m === "simulation" ? "SIMULATION" : "HARDWARE"}
                </button>
              ))}
            </div>
            <Popover onOpenChange={(o) => o && setSeen(Date.now())}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Recent activity</span>
                  {live.mode === "simulation" && <SimTag />}
                </div>
                <ul className="scroll-thin max-h-80 overflow-auto px-4">
                  {live.liveEvents.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No new activity
                    </li>
                  )}
                  {live.liveEvents.slice(0, 12).map((e) => (
                    <EventRow
                      key={e.id}
                      dense
                      now={live.now}
                      event={{ ...e, label: EVENT_LABELS[e.event_type] }}
                      roomName={roomName(e.room_id)}
                    />
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary"
                  aria-label="Account menu"
                >
                  {email?.[0] ?? "?"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {live.mode === "simulation" && live.simStatus === "running" && (
            <span
              aria-hidden
              className="animate-live-pulse absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
            />
          )}
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
