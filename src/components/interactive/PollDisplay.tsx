import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PollConfig, PollResult } from "../../../shared/types";

interface Props {
  config: PollConfig;
  result?: PollResult;
  dark?: boolean;
}

const COLORS = ["#6366F1", "#0D9488", "#F97316", "#EC4899", "#8B5CF6", "#14B8A6", "#F59E0B"];

export default function PollDisplay({ config, result, dark = false }: Props) {
  const hasResult = result && result.totalResponses > 0;
  const data = config.options.map((opt, i) => ({
    name: opt.length > 12 ? opt.slice(0, 12) + "..." : opt,
    fullName: opt,
    count: result?.optionCounts[i] ?? 0,
    percent: result?.optionPercentages[i] ?? 0,
  }));

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      <h3
        className={`font-display text-xl md:text-2xl leading-tight ${dark ? "text-white" : "text-slate-800"}`}
      >
        {config.question}
      </h3>
      {!hasResult ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-400"} animate-pulse-soft`}>
            等待观众投票...
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          <div className="md:w-1/2 space-y-2.5">
            {config.options.map((opt, i) => {
              const pct = result!.optionPercentages[i] ?? 0;
              const cnt = result!.optionCounts[i] ?? 0;
              return (
                <div key={i} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-sm font-medium ${dark ? "text-white/90" : "text-slate-700"}`}
                    >
                      {opt}
                    </span>
                    <span
                      className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}
                    >
                      {pct}% <span className="opacity-60">({cnt})</span>
                    </span>
                  </div>
                  <div
                    className={`h-3 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-100"}`}
                  >
                    <div
                      className="h-full rounded-full origin-left animate-bar-grow transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 2) % COLORS.length]})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="md:w-1/2 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{
                    fontSize: 11,
                    fill: dark ? "rgba(255,255,255,0.8)" : "#64748b",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    fontSize: 12,
                  }}
                  formatter={(v: number, _n, props) => [
                    `${v} 票 · ${props.payload.percent}%`,
                    props.payload.fullName,
                  ]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`url(#poll-gradient-${i})`}
                    />
                  ))}
                  <defs>
                    {data.map((_, i) => (
                      <linearGradient
                        key={i}
                        id={`poll-gradient-${i}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity="0.9" />
                        <stop offset="100%" stopColor={COLORS[(i + 2) % COLORS.length]} stopOpacity="0.9" />
                      </linearGradient>
                    ))}
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {hasResult && (
        <div className={`text-xs ${dark ? "text-white/60" : "text-slate-400"} text-center`}>
          共 <span className="font-semibold">{result!.totalResponses}</span> 人参与投票
        </div>
      )}
    </div>
  );
}
