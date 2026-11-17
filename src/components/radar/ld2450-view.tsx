import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type {
  Door,
  LD2450Frame,
  LD2450Target,
  PlaybackTargetState,
  RoomObject,
  RoomZone,
} from "@/lib/radar/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILL = ["fill-chart-1", "fill-chart-2", "fill-chart-3"];
const STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3"];
const RANGE_MM = 6000;
const FOV_DEG = 120;
const HALF = (FOV_DEG / 2) * (Math.PI / 180);
const SWEEP_DEG = 7;

interface Props {
  widthMm: number;
  lengthMm: number;
  frame?: LD2450Frame | undefined;
  playbackTargets?: PlaybackTargetState[] | undefined;
  selected?: number | null;
  onSelect?: (id: number | null) => void;
  showTrails?: boolean;
  compact?: boolean;
  stale?: boolean;
  /** Rotating scan wedge. Off in compact previews. */
  sweep?: boolean;
  /** Draw the door opening the simulation walks targets through. */
  door?: boolean;
  doors?: Door[] | undefined;
  zones?: RoomZone[] | undefined;
  objects?: RoomObject[] | undefined;
  showZones?: boolean | undefined;
  showObjects?: boolean | undefined;
}

/** Top-down LD2450 target view. Sensor sits at the centre of the top (y=0) wall. */
export function LD2450View({
  widthMm: W,
  lengthMm: L,
  frame,
  playbackTargets,
  selected,
  onSelect,
  showTrails = true,
  compact,
  stale,
  sweep = true,
  door = false,
  doors,
  zones,
  objects,
  showZones = true,
  showObjects = true,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pad = 600;
  const trails = useRef(new Map<number, { x: number; y: number }[]>());
  const [, force] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const effectiveTargets: LD2450Target[] = playbackTargets
    ? playbackTargets.map((p) => ({
        target_id: p.target_id,
        x_mm: p.x_mm,
        y_mm: p.y_mm,
        speed_cms: p.speed_cms,
      }))
    : (frame?.targets ?? []);

  useEffect(() => {
    if (!frame) {
      trails.current.clear();
      return;
    }
    const ids = new Set(frame.targets.map((t) => t.target_id));
    for (const id of [...trails.current.keys()]) if (!ids.has(id)) trails.current.delete(id);
    for (const t of frame.targets) {
      const arr = trails.current.get(t.target_id) ?? [];
      arr.push({ x: t.x_mm + W / 2, y: t.y_mm });
      if (arr.length > 40) arr.shift();
      trails.current.set(t.target_id, arr);
    }
    force((n) => n + 1);
  }, [frame, W]);

  const vbW = (W + pad * 2) / zoom;
  const vbH = (L + pad * 2) / zoom;
  const cx = W / 2 + pan.x;
  const cy = L / 2 + pan.y;
  const viewBox = `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`;
  const clip = `url(#room-${uid})`;
  const half = HALF;
  const fovPath = `M ${W / 2} 0 L ${W / 2 - Math.sin(half) * RANGE_MM} ${Math.cos(half) * RANGE_MM} A ${RANGE_MM} ${RANGE_MM} 0 0 0 ${W / 2 + Math.sin(half) * RANGE_MM} ${Math.cos(half) * RANGE_MM} Z`;
  const sw = (SWEEP_DEG * Math.PI) / 180;
  const wedge = `M 0 0 L ${-Math.sin(sw) * RANGE_MM} ${Math.cos(sw) * RANGE_MM} A ${RANGE_MM} ${RANGE_MM} 0 0 0 ${Math.sin(sw) * RANGE_MM} ${Math.cos(sw) * RANGE_MM} Z`;
  const doorX = W - 300;
  const doorW = 900;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-target]")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const k = vbW / rect.width;
    setPan({
      x: drag.current.px - (e.clientX - drag.current.x) * k,
      y: drag.current.py - (e.clientY - drag.current.y) * k,
    });
  };

  const minor = [];
  for (let x = 0; x <= W; x += 500)
    if (x % 1000) minor.push(<line key={`mx${x}`} x1={x} y1={0} x2={x} y2={L} />);
  for (let y = 0; y <= L; y += 500)
    if (y % 1000) minor.push(<line key={`my${y}`} x1={0} y1={y} x2={W} y2={y} />);
  const major = [];
  for (let x = 0; x <= W; x += 1000)
    major.push(<line key={`bx${x}`} x1={x} y1={0} x2={x} y2={L} />);
  for (let y = 0; y <= L; y += 1000)
    major.push(<line key={`by${y}`} x1={0} y1={y} x2={W} y2={y} />);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-radar-floor",
        stale && "opacity-75",
      )}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={cn(
          "block w-full touch-none select-none",
          compact ? "h-40" : "h-[460px] cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={compact ? undefined : onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onWheel={
          compact
            ? undefined
            : (e) => setZoom((z) => Math.min(4, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9))))
        }
        onClick={(e) => {
          if (!(e.target as Element).closest("[data-target]")) onSelect?.(null);
        }}
        role="img"
        aria-label={`Top-down room view, ${frame?.targets.length ?? 0} LD2450 target(s)`}
      >
        <defs>
          <clipPath id={`room-${uid}`}>
            <rect x={0} y={0} width={W} height={L} rx={60} />
          </clipPath>
          <radialGradient
            id={`fov-${uid}`}
            cx={W / 2}
            cy={0}
            r={RANGE_MM}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
            <stop offset="55%" stopColor="var(--primary)" stopOpacity={0.06} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.015} />
          </radialGradient>
          <radialGradient
            id={`sweep-${uid}`}
            cx={0}
            cy={0}
            r={RANGE_MM}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity={0.1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`floor-${uid}`} x1={0} y1={0} x2={0} y2={1}>
            <stop offset="0%" stopColor="var(--radar-floor-2)" />
            <stop offset="100%" stopColor="var(--radar-floor)" />
          </linearGradient>
          <pattern
            id={`hatch-${uid}`}
            width={260}
            height={260}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={260}
              className="stroke-warning"
              strokeWidth={26}
              strokeOpacity={0.35}
            />
          </pattern>
        </defs>

        {/* floor */}
        <rect x={0} y={0} width={W} height={L} rx={60} fill={`url(#floor-${uid})`} />

        {/* grid */}
        <g className="stroke-grid" strokeWidth={6}>
          {minor}
        </g>
        <g className="stroke-grid-strong" strokeWidth={8}>
          {major}
        </g>

        {/* field of view + range rings */}
        <g clipPath={clip}>
          <path d={fovPath} fill={`url(#fov-${uid})`} />
          <g
            className="stroke-radar-range"
            fill="none"
            strokeWidth={compact ? 26 : 8}
            strokeDasharray={compact ? "120 130" : "50 70"}
          >
            {Array.from({ length: Math.floor(RANGE_MM / (compact ? 2000 : 1000)) }, (_, i) => (
              <circle key={i} cx={W / 2} cy={0} r={(i + 1) * (compact ? 2000 : 1000)} />
            ))}
          </g>
          {!compact && (
            <g className="fill-foreground/70 font-mono" fontSize={130}>
              {Array.from({ length: Math.floor(RANGE_MM / 1000) }, (_, i) => {
                const r = (i + 1) * 1000;
                return (
                  <text
                    key={i}
                    x={W / 2 + Math.sin(0.6) * r + 60}
                    y={Math.cos(0.6) * r + 40}
                    stroke="var(--radar-floor)"
                    strokeWidth={30}
                    paintOrder="stroke"
                  >
                    {i + 1}m
                  </text>
                );
              })}
            </g>
          )}
          {sweep && !compact && (
            <g transform={`translate(${W / 2} 0)`}>
              <path d={wedge} fill={`url(#sweep-${uid})`}>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`${-FOV_DEG / 2};${FOV_DEG / 2};${-FOV_DEG / 2}`}
                  dur="6s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
          {/* Defined Zones */}
          {showZones &&
            zones &&
            zones.map((z) => {
              const pointsStr = z.polygon.map((p) => `${p.x_mm},${p.y_mm}`).join(" ");
              const isHazard = z.type === "hazard";
              const isBed = z.type === "bed";
              const isSofa = z.type === "sofa";
              const fillColor = isHazard
                ? "rgba(239, 68, 68, 0.16)"
                : isBed
                  ? "rgba(59, 130, 246, 0.16)"
                  : isSofa
                    ? "rgba(245, 158, 11, 0.16)"
                    : "rgba(168, 85, 247, 0.14)";
              const strokeColor = isHazard
                ? "#ef4444"
                : isBed
                  ? "#3b82f6"
                  : isSofa
                    ? "#f59e0b"
                    : "#a855f7";
              const avgX = z.polygon.reduce((sum, p) => sum + p.x_mm, 0) / (z.polygon.length || 1);
              const avgY = z.polygon.reduce((sum, p) => sum + p.y_mm, 0) / (z.polygon.length || 1);
              return (
                <g key={`zone-${z.id}`}>
                  <polygon
                    points={pointsStr}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isHazard ? 18 : 12}
                    strokeDasharray={isHazard ? "40 30" : undefined}
                    strokeLinejoin="round"
                  />
                  {!compact && (
                    <text
                      x={avgX}
                      y={avgY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={strokeColor}
                      fontSize={110}
                      className="font-mono font-medium select-none pointer-events-none"
                    >
                      {z.name}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Defined Furniture & Objects */}
          {showObjects &&
            objects &&
            objects.map((obj) => (
              <g
                key={`obj-${obj.id}`}
                transform={`translate(${obj.x_mm} ${obj.y_mm}) rotate(${obj.rotation_deg})`}
              >
                <rect
                  x={-obj.width_mm / 2}
                  y={-obj.length_mm / 2}
                  width={obj.width_mm}
                  height={obj.length_mm}
                  rx={30}
                  className="fill-muted/40 stroke-foreground/25"
                  strokeWidth={14}
                />
                {!compact && (
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={100}
                    className="fill-foreground/50 font-mono select-none pointer-events-none"
                  >
                    {obj.name}
                  </text>
                )}
              </g>
            ))}

          {/* trails */}
          {showTrails &&
            playbackTargets &&
            playbackTargets.map((pt) => {
              if (pt.trail.length < 2) return null;
              const pts = pt.trail.map((p) => `${p.x + W / 2},${p.y}`).join(" ");
              const col = STROKE[(pt.target_id - 1) % 3];
              return (
                <polyline
                  key={`pb-trail-${pt.target_id}`}
                  points={pts}
                  className={cn("fill-none", col)}
                  strokeWidth={14}
                  strokeDasharray="24 16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                />
              );
            })}
          {showTrails &&
            !playbackTargets &&
            [...trails.current.entries()].map(([id, pts]) => (
              <g key={`t${id}`}>
                {pts.slice(1).map((p, i) => {
                  const q = pts[i];
                  if (!q) return null;
                  const a = ((i + 1) / pts.length) ** 2 * 0.55;
                  return (
                    <line
                      key={i}
                      x1={q.x}
                      y1={q.y}
                      x2={p.x}
                      y2={p.y}
                      className={STROKE[(id - 1) % 3]}
                      strokeWidth={40 * ((i + 1) / pts.length) + 8}
                      strokeOpacity={a}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            ))}
        </g>

        {/* FOV edges */}
        <path
          d={fovPath}
          className="fill-none stroke-primary/35"
          strokeWidth={10}
          strokeDasharray="60 50"
          clipPath={clip}
        />

        {/* walls */}
        <rect
          x={0}
          y={0}
          width={W}
          height={L}
          className="fill-none stroke-radar-wall"
          strokeWidth={34}
          rx={60}
        />
        {!compact && (
          <g clipPath={clip}>
            {doors && doors.length > 0
              ? doors.map((d) => {
                  const dW = d.width_mm || 900;
                  return (
                    <g key={`door-${d.id}`}>
                      <rect
                        x={d.x_mm - dW / 2}
                        y={d.y_mm - 40}
                        width={dW}
                        height={80}
                        className="fill-radar-floor"
                      />
                      <path
                        d={`M ${d.x_mm - dW / 2} ${d.y_mm} A ${dW} ${dW} 0 0 1 ${d.x_mm - dW / 2} ${d.y_mm - dW}`}
                        className="fill-none stroke-radar-wall"
                        strokeWidth={7}
                        strokeDasharray="40 40"
                        opacity={0.6}
                      />
                      <text
                        x={d.x_mm}
                        y={d.y_mm - 90}
                        textAnchor="middle"
                        fontSize={110}
                        className="fill-foreground/60 font-mono"
                      >
                        {d.name || "door"}
                      </text>
                    </g>
                  );
                })
              : door && (
                  <g>
                    <rect
                      x={doorX - doorW / 2}
                      y={L - 40}
                      width={doorW}
                      height={80}
                      className="fill-radar-floor"
                    />
                    <path
                      d={`M ${doorX - doorW / 2} ${L} A ${doorW} ${doorW} 0 0 1 ${doorX - doorW / 2} ${L - doorW}`}
                      className="fill-none stroke-radar-wall"
                      strokeWidth={7}
                      strokeDasharray="40 40"
                      opacity={0.5}
                    />
                    <text
                      x={doorX}
                      y={L - 90}
                      textAnchor="middle"
                      fontSize={110}
                      className="fill-foreground/60 font-mono"
                    >
                      door
                    </text>
                  </g>
                )}
          </g>
        )}

        {/* axis ticks */}
        {!compact && (
          <g className="fill-foreground/55 font-mono" fontSize={115}>
            {Array.from({ length: Math.floor(W / 1000) + 1 }, (_, i) => (
              <text key={`lx${i}`} x={i * 1000} y={-150} textAnchor="middle">
                {i}m
              </text>
            ))}
            {Array.from(
              { length: Math.floor(L / 1000) + 1 },
              (_, i) =>
                i > 0 && (
                  <text key={`ly${i}`} x={-150} y={i * 1000 + 40} textAnchor="end">
                    {i}m
                  </text>
                ),
            )}
          </g>
        )}

        {/* sensor */}
        <g transform={`translate(${W / 2} 0)`}>
          <rect x={-170} y={-78} width={340} height={150} rx={34} className="fill-radar-wall" />
          <circle r={38} className="fill-primary">
            {!compact && (
              <animate
                attributeName="opacity"
                values="1;0.45;1"
                dur="2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          {!compact && (
            <text
              y={-140}
              textAnchor="middle"
              fontSize={125}
              className="fill-foreground font-sans font-semibold"
            >
              LD2450
            </text>
          )}
        </g>

        {/* targets */}
        {effectiveTargets.map((t) => (
          <TargetDot
            key={t.target_id}
            t={t}
            W={W}
            compact={compact}
            selected={selected === t.target_id}
            hovered={hover === t.target_id}
            onHover={setHover}
            onClick={() => onSelect?.(t.target_id)}
          />
        ))}

        {/* selected projections */}
        {!compact &&
          selected != null &&
          (() => {
            const t = effectiveTargets.find((x) => x.target_id === selected);
            if (!t) return null;
            const x = t.x_mm + W / 2,
              y = t.y_mm;
            return (
              <g
                className="stroke-foreground/45"
                strokeWidth={7}
                strokeDasharray="30 30"
                pointerEvents="none"
              >
                <line x1={x} y1={y} x2={x} y2={L} />
                <line x1={x} y1={y} x2={0} y2={y} />
              </g>
            );
          })()}

        {/* scale + legend are rendered as an HTML overlay below */}

        {/* stale overlay */}
        {stale && !compact && (
          <g pointerEvents="none" clipPath={clip}>
            <rect x={0} y={0} width={W} height={L} fill={`url(#hatch-${uid})`} />
          </g>
        )}
      </svg>

      {stale && !compact && (
        <span className="absolute left-3 top-3 rounded-md bg-warning/15 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-warning-foreground ring-1 ring-inset ring-warning/30">
          STALE FRAME
        </span>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-card px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-chart-1" />
            target
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-warning" />
            moving away
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-success" />
            moving towards
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-0.5 w-4 rounded-full bg-primary/45" />
            field of view
          </span>
        </div>
      )}

      {!compact && (
        <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-card backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
          <span className="font-mono text-[10px] tabular text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset view"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function TargetDot({
  t,
  W,
  selected,
  hovered,
  onHover,
  onClick,
  compact,
}: {
  t: LD2450Target;
  W: number;
  selected: boolean;
  hovered: boolean;
  onHover: (id: number | null) => void;
  onClick: () => void;
  compact?: boolean | undefined;
}) {
  const x = t.x_mm + W / 2;
  const y = t.y_mm;
  const r = compact ? 190 : 150;
  const cls = FILL[(t.target_id - 1) % 3];
  const speed = Math.abs(t.speed_cms);
  const moving = speed > 15;
  const len = Math.min(900, 180 + speed * 6);
  const d = Math.hypot(t.x_mm, t.y_mm) || 1;
  const ux = t.x_mm / d,
    uy = t.y_mm / d;
  const sign = Math.sign(t.speed_cms) || 1;
  const ax = ux * len * sign,
    ay = uy * len * sign;
  const arrow = moving
    ? t.speed_cms > 0
      ? "stroke-warning"
      : "stroke-success"
    : "stroke-muted-foreground";

  return (
    <g
      data-target
      style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 150ms linear" }}
      className="cursor-pointer"
      onClick={onClick}
      onPointerEnter={() => onHover(t.target_id)}
      onPointerLeave={() => onHover(null)}
      role="button"
      tabIndex={0}
      aria-label={`Target ${t.target_id}, ${t.x_mm} by ${t.y_mm} millimetres, ${t.speed_cms} centimetres per second`}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {!selected && !hovered && (
        <circle r={r * 2.3} className={cn(cls, "opacity-15")}>
          <animate
            attributeName="r"
            values={`${r * 1.5};${r * 2.7};${r * 1.5}`}
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {selected && (
        <circle
          r={r + 110}
          className="fill-none stroke-foreground"
          strokeWidth={14}
          strokeDasharray="24 22"
        />
      )}
      {!compact && moving && (
        <g className={cn(arrow, "fill-none")} strokeWidth={16} strokeLinecap="round">
          <line x1={ux * r * 1.1} y1={uy * r * 1.1} x2={ax} y2={ay} />
          <path
            d={`M ${ax} ${ay} l ${-ux * 130 + uy * 80} ${-uy * 130 - ux * 80} m 0 0 l ${-ux * 130 - uy * 80} ${-uy * 130 + ux * 80}`}
          />
        </g>
      )}
      <circle r={r} className={cn(cls, "stroke-card")} strokeWidth={selected ? 55 : 26} />
      <text
        y={r * 0.38}
        textAnchor="middle"
        fontSize={r * 1.05}
        className="fill-card font-sans font-bold"
      >
        {t.target_id}
      </text>
      {!compact &&
        (selected || hovered) &&
        (() => {
          const label = `${t.x_mm} / ${t.y_mm} mm · ${t.speed_cms} cm/s`;
          const w = label.length * 62 + 90;
          const above = y > 700 && t.speed_cms >= 0;
          return (
            <g pointerEvents="none">
              <line
                x1={0}
                y1={above ? -(r + 8) : r + 8}
                x2={0}
                y2={above ? -(r + 260) : r + 260}
                className="stroke-radar-wall"
                strokeWidth={7}
                opacity={0.45}
              />
              <g transform={`translate(0 ${above ? -r - 320 : r + 320})`}>
                <rect
                  x={-w / 2}
                  y={-95}
                  width={w}
                  height={155}
                  rx={40}
                  className="fill-radar-wall"
                  opacity={0.94}
                />
                <text
                  y={-8}
                  textAnchor="middle"
                  fontSize={100}
                  className="fill-background font-mono"
                >
                  {label}
                </text>
              </g>
            </g>
          );
        })()}
    </g>
  );
}
