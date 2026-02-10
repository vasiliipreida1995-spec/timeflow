"use client";

type DataItem = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  data: DataItem[];
};

export default function PieChart({ data }: PieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted">
        Нет данных для отображения
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted">
        Нет данных для отображения
      </div>
    );
  }

  const size = 200;
  const center = size / 2;
  const radius = 70;
  const holeRadius = 45;

  let currentAngle = -90;
  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const outerPath = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const hx1 = center + holeRadius * Math.cos(startRad);
    const hy1 = center + holeRadius * Math.sin(startRad);
    const hx2 = center + holeRadius * Math.cos(endRad);
    const hy2 = center + holeRadius * Math.sin(endRad);

    const donutPath = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${hx2} ${hy2}
      A ${holeRadius} ${holeRadius} 0 ${largeArc} 0 ${hx1} ${hy1}
      Z
    `;

    return {
      ...item,
      path: donutPath,
      percentage: percentage.toFixed(1),
    };
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full"
        style={{ maxWidth: "240px", height: "240px" }}
      >
        <defs>
          {segments.map((seg, i) => (
            <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={seg.color} stopOpacity="1" />
              <stop offset="100%" stopColor={seg.color} stopOpacity="0.7" />
            </linearGradient>
          ))}
        </defs>

        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill={`url(#grad-${i})`}
            className="transition-all duration-300 hover:opacity-80"
            style={{
              filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
              animation: `fadeIn 0.6s ease-out ${i * 0.1}s both`,
            }}
          />
        ))}

        <circle
          cx={center}
          cy={center}
          r={holeRadius}
          fill="rgba(11, 13, 16, 0.95)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />

        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="rgba(255, 255, 255, 0.9)"
        >
          {data.length}
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          fontSize="12"
          fill="rgba(255, 255, 255, 0.5)"
        >
          {data.length === 1 ? "проект" : "проектов"}
        </text>
      </svg>

      <div className="grid w-full gap-2">
        {segments.slice(0, 5).map((seg, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-sm"
            style={{
              animation: `slide-in-left 0.4s ease-out ${i * 0.08}s both`,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ background: seg.color }}
              />
              <span className="truncate">{seg.label}</span>
            </div>
            <span className="font-semibold text-muted flex-shrink-0">{seg.percentage}%</span>
          </div>
        ))}
        {segments.length > 5 && (
          <div className="text-xs text-muted">
            +{segments.length - 5} еще
          </div>
        )}
      </div>
    </div>
  );
}
