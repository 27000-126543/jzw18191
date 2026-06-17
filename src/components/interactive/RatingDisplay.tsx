import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Star } from "lucide-react";
import type { RatingConfig, RatingResult } from "../../../shared/types";
import { sanitizeRatingConfig } from "../../../shared/types";

interface Props {
  config: RatingConfig;
  result?: RatingResult;
  dark?: boolean;
}

export default function RatingDisplay({ config, result, dark = false }: Props) {
  const safe = sanitizeRatingConfig(config);
  const hasData = result && result.totalResponses > 0;
  const avg = result?.average ?? 0;
  const total = result?.totalResponses ?? 0;
  const stepCount = Math.max(1, Math.min(100, Math.floor((safe.max - safe.min) / safe.step) + 1));
  const starCount = Math.min(10, stepCount);
  const starFillRatio = avg / safe.max;

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      <h3
        className={`font-display text-xl md:text-2xl leading-tight ${dark ? "text-white" : "text-slate-800"}`}
      >
        {safe.title}
      </h3>
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-400"} animate-pulse-soft`}>
            等待观众评分...
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          <div className="md:w-2/5 flex flex-col items-center justify-center gap-3">
            <div className={`text-xs uppercase tracking-wider ${dark ? "text-white/60" : "text-slate-400"}`}>
              平均分
            </div>
            <div
              className={`font-display text-6xl md:text-7xl leading-none bg-gradient-to-br from-highlight-400 via-highlight-500 to-highlight-600 bg-clip-text text-transparent`}
            >
              {avg.toFixed(2)}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: starCount }, (_, i) => {
                const fill = (i + 1) / starCount <= starFillRatio;
                const partial = !fill && i / starCount < starFillRatio;
                return (
                  <Star
                    key={i}
                    className={`w-6 h-6 transition-all ${
                      fill
                        ? "fill-highlight-400 text-highlight-400"
                        : partial
                        ? "fill-highlight-400/50 text-highlight-400/50"
                        : dark
                        ? "text-white/20"
                        : "text-slate-200"
                    }`}
                  />
                );
              })}
            </div>
            {(safe.minLabel || safe.maxLabel) && (
              <div
                className={`flex justify-between w-full text-xs ${dark ? "text-white/50" : "text-slate-400"}`}
              >
                <span>{safe.minLabel}</span>
                <span>{safe.maxLabel}</span>
              </div>
            )}
          </div>
          <div className="md:w-3/5 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result!.distribution} margin={{ top: 10, bottom: 20 }}>
                <XAxis
                  dataKey="rating"
                  type="number"
                  domain={[safe.min, safe.max]}
                  tick={{
                    fontSize: 12,
                    fill: dark ? "rgba(255,255,255,0.8)" : "#64748b",
                  }}
                  axisLine={!dark}
                  stroke={dark ? "rgba(255,255,255,0.2)" : "#e2e8f0"}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} 人`, "评分人数"]}
                  labelFormatter={(l) => `${l} 分`}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                  {result!.distribution.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.rating <= Math.round(avg) ? "url(#rating-gradient-active)" : "url(#rating-gradient)"}
                    />
                  ))}
                  <defs>
                    <linearGradient id="rating-gradient-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB923C" />
                      <stop offset="100%" stopColor="#F97316" />
                    </linearGradient>
                    <linearGradient id="rating-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CBD5E1" />
                      <stop offset="100%" stopColor="#94A3B8" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {hasData && (
        <div className={`text-xs ${dark ? "text-white/60" : "text-slate-400"} text-center`}>
          共 <span className="font-semibold">{total}</span> 人参与评分 · 刻度 {safe.min}~{safe.max} 步长 {safe.step}
        </div>
      )}
    </div>
  );
}
