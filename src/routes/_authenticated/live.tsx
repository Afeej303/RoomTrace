import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Boxes, Pause, Play, Radar, WifiOff } from "lucide-react";
import { roomsQuery } from "@/lib/data";
import { isStale, roomState, useLive, type RoomLive } from "@/lib/radar/live";
import { EVENT_LABELS } from "@/lib/radar/types";
import {
  Empty,
  PageHeader,
  Panel,
  Pill,
  RoomBadge,
  SimTag,
  timeAgo,
} from "@/components/app/status";
import { EventRow } from "@/components/app/event-row";
import { ModeToggle, SimControls } from "@/components/app/sim-controls";
import { LD2450View } from "@/components/radar/ld2450-view";
import { RD61View } from "@/components/radar/rd61-view";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({
    meta: [
      { title: "Live Monitoring — RoomTrace" },
      {
        name: "description",
        content: "Real-time occupancy and target tracking for a selected room.",
      },
      { property: "og:title", content: "Live Monitoring — RoomTrace" },
      {
        property: "og:description",
        content: "Real-time occupancy and target tracking for a selected room.",
      },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { data: rooms = [], isLoading } = useQuery(roomsQuery);
  const live = useLive();
  const room = rooms.find((r) => r.id === live.selectedRoomId);
  const [frozen, setFrozen] = useState<RoomLive | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const current = room ? live.frames[room.id] : undefined;
  const view = frozen ?? current;
  const sim = live.mode === "simulation";
  const stale = isStale(view?.ld?.timestamp, live.now);
  const state = roomState(current, live.now, live.mode);
  const lastRoom = useRef(room?.id);
  useEffect(() => {
    if (lastRoom.current !== room?.id) {
      setFrozen(null);
      lastRoom.current = room?.id;
    }
  }, [room?.id]);

  if (!isLoading && rooms.length === 0)
    return (
      <>
        <PageHeader title="Live Monitoring" />
        <Panel>
          <Empty
            icon={<Boxes className="size-5" />}
            title="No rooms to monitor"
            action={
              <Button asChild>
                <Link to="/rooms">Create a room</Link>
              </Button>
            }
          >
            Add a room first.
          </Empty>
        </Panel>
      </>
    );

  const roomEvents = live.liveEvents.filter((e) => e.room_id === room?.id);

  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        description={
          room
            ? `${room.name} · ${(room.width_mm / 1000).toFixed(1)} × ${(room.length_mm / 1000).toFixed(1)} m`
            : "Select a room"
        }
        actions={
          <>
            <ModeToggle />
            <SimControls roomId={room?.id ?? null} />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setFrozen(frozen ? null : (current ?? {}))}
            >
              {frozen ? (
                <>
                  <Play className="size-4" /> Resume view
                </>
              ) : (
                <>
                  <Pause className="size-4" /> Freeze view
                </>
              )}
            </Button>
          </>
        }
      />

      {!sim && live.streamStatus !== "live" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <WifiOff className="size-4" />{" "}
          {live.streamStatus === "connecting"
            ? "Connecting to realtime telemetry…"
            : "Realtime connection lost — retrying automatically."}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              LD2450 target map {sim && <SimTag />} {frozen && <Pill t="warning">Frozen</Pill>}
            </span>
          }
          subtitle="Top-down view, sensor at the centre of the near wall"
          action={<RoomBadge s={state} />}
        >
          {room && view?.ld ? (
            <LD2450View
              widthMm={room.width_mm}
              lengthMm={room.length_mm}
              doors={room.doors}
              zones={room.zones}
              objects={room.objects}
              frame={view.ld}
              selected={selected}
              onSelect={setSelected}
              stale={stale && !frozen}
              door={sim}
            />
          ) : (
            <Empty
              icon={<Radar className="size-5" />}
              title={
                sim
                  ? live.simStatus === "stopped"
                    ? "Simulation stopped"
                    : "Sensor offline (simulated)"
                  : "No telemetry received"
              }
            >
              {sim
                ? "Start the simulation or pick another scenario."
                : "No hardware data has been received for this room. Assign a registered ESP32-S3 to this room and send telemetry."}
            </Empty>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Room status">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Occupancy</dt>
                <dd className="mt-1">
                  <RoomBadge s={state} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Targets</dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular">
                  {view?.ld && !stale ? view.ld.targets.length : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd className="mt-1">{sim ? <SimTag /> : <Pill t="success">Hardware</Pill>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last frame</dt>
                <dd className="mt-1 tabular">
                  {timeAgo(view?.ld?.timestamp, live.now)}
                  {stale && view?.ld && (
                    <Pill t="warning" className="ml-2">
                      Stale
                    </Pill>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">RD-61 points</dt>
                <dd className="mt-1 font-mono tabular">{view?.rd ? view.rd.points.length : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Stream</dt>
                <dd className="mt-1 capitalize">{live.streamStatus}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Detected targets"
            hint="LD2450 reports up to 3 targets. x is lateral offset from the sensor axis, y is distance from the sensor. Speed is signed radial speed."
            bodyClass="p-0"
          >
            {view?.ld && view.ld.targets.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">ID</th>
                    <th className="px-4 py-2 text-right font-medium">X (mm)</th>
                    <th className="px-4 py-2 text-right font-medium">Y (mm)</th>
                    <th className="px-4 py-2 text-right font-medium">Speed</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular">
                  {view.ld.targets.map((t) => (
                    <tr
                      key={t.target_id}
                      onClick={() => setSelected(t.target_id)}
                      className={`cursor-pointer border-t transition-colors ${selected === t.target_id ? "bg-accent" : "hover:bg-muted/50"}`}
                    >
                      <td className="px-4 py-2 font-sans font-semibold text-foreground">
                        #{t.target_id}
                      </td>
                      <td className="px-4 py-2 text-right">{t.x_mm}</td>
                      <td className="px-4 py-2 text-right">{t.y_mm}</td>
                      <td
                        className={`px-4 py-2 text-right ${t.speed_cms > 15 ? "text-warning-foreground" : t.speed_cms < -15 ? "text-success" : "text-muted-foreground"}`}
                      >
                        {t.speed_cms}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {view?.ld ? "No targets in the detection zone." : "No target data available."}
              </p>
            )}
            {view?.ld && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                Detected {new Date(view.ld.timestamp).toLocaleTimeString()}
              </p>
            )}
          </Panel>

          <Panel
            title={<>RD-61 point cloud {sim && <SimTag />}</>}
            subtitle="Raw reflections, not identified people"
            bodyClass="p-3"
          >
            {view?.rd ? (
              <RD61View
                compact
                widthMm={room?.width_mm ?? 5000}
                lengthMm={room?.length_mm ?? 6000}
                doors={room?.doors}
                zones={room?.zones}
                objects={room?.objects}
                frame={view.rd}
                height={190}
                persistence={4}
              />
            ) : (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                No RD-61 frames yet.
              </p>
            )}
          </Panel>

          <Panel title="Latest updates">
            {roomEvents.length ? (
              <ol className="scroll-thin -my-2 max-h-64 overflow-auto">
                {roomEvents.slice(0, 6).map((e) => (
                  <EventRow
                    key={e.id}
                    dense
                    now={live.now}
                    event={{ ...e, label: EVENT_LABELS[e.event_type] }}
                  />
                ))}
              </ol>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No updates yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
