"use client";

type DataPoint = {
  month: string;
  hours: number;
  label: string;
};

type MonthTrendChartProps = {
  data: DataPoint[];
};

export default function MonthTrendChart({ data }: MonthTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted">
        Нет данных для отображения
      </div>
    );
  }

  const maxHours = Math.max(...data.map((d) => d.hours), 1);
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * chartWidth + padding.left;
    const y = height - padding.bottom - (d.hours / maxHours) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: "240px" }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(125,211,167,0.3)" />
            <stop offset="100%" stopColor="rgba(125,211,167,0.05)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding.bottom - ratio * chartHeight;
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Area */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="rgba(125,211,167,0.8)" strokeWidth="2" />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="rgba(125,211,167,1)" />
        ))}

        {/* Y-axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const y = height - padding.bottom - ratio * chartHeight;
          const value = (ratio * maxHours).toFixed(0);
          return (
            <text
              key={ratio}
              x={padding.left - 10}
              y={y + 5}
              textAnchor="end"
              fontSize="18"
              fill="rgba(255,255,255,0.7)"
              fontFamily="system-ui"
              fontWeight="500"
            >
              {value}ч
            </text>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - padding.bottom + 28}
            textAnchor="middle"
            fontSize="18"
            fill="rgba(255,255,255,0.7)"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
