import { useState, useId, useMemo } from "react";

interface PerformanceLineChartProps {
  data: number[];
  timestamps?: number[];
  unit?: string;
  formatValue?: (val: number) => string;
  maxVal?: number; // Optional forced max (e.g. 100 for %)
  minVal?: number;
  height?: number;
  accentColor?: string; // default to primary
  label?: string;
  compact?: boolean;
}

export function PerformanceLineChart({
  data,
  timestamps = [],
  unit = "%",
  formatValue = (v) => `${v.toFixed(1)}${unit}`,
  maxVal,
  minVal = 0,
  height = 42,
  accentColor = "var(--color-primary, #3b82f6)",
  label,
  compact = true,
}: PerformanceLineChartProps) {
  const chartId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Determine dynamic range
  const { computedMin, computedMax } = useMemo(() => {
    if (data.length === 0) return { computedMin: 0, computedMax: maxVal ?? 100 };
    const currentMax = Math.max(...data);
    const upper = maxVal !== undefined ? maxVal : Math.max(10, Math.ceil(currentMax * 1.15));
    return { computedMin: minVal, computedMax: upper };
  }, [data, maxVal, minVal]);

  // Dimensions
  const svgWidth = 400;
  const paddingX = 2;
  const paddingTop = 3;
  const paddingBottom = compact ? 8 : 14;
  const effectiveHeight = Math.max(10, height - paddingTop - paddingBottom);

  // Generate SVG path points
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const count = data.length;
    const stepX = (svgWidth - paddingX * 2) / Math.max(1, count - 1);
    const range = Math.max(1, computedMax - computedMin);

    return data.map((val, idx) => {
      const x = paddingX + idx * stepX;
      const normalized = Math.max(0, Math.min(1, (val - computedMin) / range));
      const y = paddingTop + effectiveHeight * (1 - normalized);
      return { x, y, val, idx };
    });
  }, [data, computedMin, computedMax, effectiveHeight, paddingTop]);

  // Smooth bezier curve path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" };
    if (points.length === 1) {
      const pt = points[0];
      return {
        linePath: `M ${pt.x} ${pt.y} L ${pt.x + 1} ${pt.y}`,
        areaPath: `M ${pt.x} ${pt.y} L ${pt.x + 1} ${pt.y} L ${pt.x + 1} ${paddingTop + effectiveHeight} L ${pt.x} ${paddingTop + effectiveHeight} Z`,
      };
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const baselineY = paddingTop + effectiveHeight;
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const area = `${d} L ${lastPt.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstPt.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { linePath: d, areaPath: area };
  }, [points, effectiveHeight, paddingTop]);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const activeHoverPoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="relative w-full select-none flex flex-col justify-end" style={{ height }}>
      {/* Background Subtle Baseline Guide */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between" style={{ top: paddingTop, bottom: paddingBottom }}>
        <div className="w-full border-b border-border/20 border-dashed" />
        <div className="w-full border-b border-border/30" />
      </div>

      {data.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground/60 italic">
          Đang kết nối giám sát...
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            let closestIdx = 0;
            let minDist = Infinity;
            for (let i = 0; i < points.length; i++) {
              const dist = Math.abs(points[i].x - relX);
              if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
              }
            }
            setHoverIndex(closestIdx);
          }}
        >
          <defs>
            <linearGradient id={`gradient-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.16" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaPath} fill={`url(#gradient-${chartId})`} />

          {/* Curve Line */}
          <path
            d={linePath}
            fill="none"
            stroke={accentColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Live Pulsing Dot on newest value */}
          {lastPoint && hoverIndex === null && (
            <g>
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="2.5"
                fill={accentColor}
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="4.5"
                fill="none"
                stroke={accentColor}
                strokeWidth="1"
                className="animate-ping opacity-50"
              />
            </g>
          )}

          {/* Hover Crosshair & Point */}
          {activeHoverPoint && (
            <g>
              <line
                x1={activeHoverPoint.x}
                y1={paddingTop}
                x2={activeHoverPoint.x}
                y2={paddingTop + effectiveHeight}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2,2"
                className="text-foreground/40"
              />
              <circle
                cx={activeHoverPoint.x}
                cy={activeHoverPoint.y}
                r="3"
                fill="white"
                stroke={accentColor}
                strokeWidth="1.8"
              />
            </g>
          )}
        </svg>
      )}

      {/* Floating Hover Tooltip */}
      {activeHoverPoint && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 bg-popover/95 text-popover-foreground border border-border shadow-md px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap backdrop-blur-xs flex items-center gap-1"
          style={{
            left: `${Math.min(92, Math.max(8, (activeHoverPoint.x / svgWidth) * 100))}%`,
            top: "-16px",
          }}
        >
          {label && <span className="text-muted-foreground">{label}:</span>}
          <span className="font-semibold">{formatValue(activeHoverPoint.val)}</span>
          {timestamps[activeHoverPoint.idx] && (
            <span className="text-muted-foreground/70 text-[8px]">
              {(() => {
                const diff = Math.max(0, Math.floor(Date.now() / 1000 - timestamps[activeHoverPoint.idx]));
                return diff === 0 ? "vừa xong" : `${diff}s trước`;
              })()}
            </span>
          )}
        </div>
      )}

      {/* Time Axis Labels */}
      {!compact && (
        <div className="w-full flex items-center justify-between text-[8px] text-muted-foreground/60 px-0.5 leading-none">
          <span>60s trước</span>
          <span>Hiện tại</span>
        </div>
      )}
    </div>
  );
}
