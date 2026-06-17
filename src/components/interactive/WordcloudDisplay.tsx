import { useMemo } from "react";
import type { WordcloudConfig, WordEntry } from "../../../shared/types";

interface Props {
  config: WordcloudConfig;
  words?: WordEntry[];
  dark?: boolean;
}

const CLOUD_COLORS = [
  "#6366F1",
  "#0D9488",
  "#F97316",
  "#EC4899",
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#EF4444",
  "#10B981",
];

export default function WordcloudDisplay({ config, words = [], dark = false }: Props) {
  const sortedWords = useMemo(() => {
    return [...words].sort((a, b) => b.count - a.count).slice(0, config.maxWords ?? 50);
  }, [words, config.maxWords]);

  const { max, min } = useMemo(() => {
    if (sortedWords.length === 0) return { max: 1, min: 1 };
    return {
      max: sortedWords[0].count,
      min: sortedWords[sortedWords.length - 1].count,
    };
  }, [sortedWords]);

  function getSize(count: number): number {
    if (max === min) return 22;
    const ratio = (count - min) / (max - min);
    return 14 + ratio * 34;
  }

  function hashColor(word: string): string {
    let h = 0;
    for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
    return CLOUD_COLORS[h % CLOUD_COLORS.length];
  }

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      <h3
        className={`font-display text-xl md:text-2xl leading-tight ${dark ? "text-white" : "text-slate-800"}`}
      >
        {config.prompt}
      </h3>
      {sortedWords.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-400"} animate-pulse-soft`}>
            等待观众提交关键词...
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative flex flex-wrap items-center justify-center gap-x-5 gap-y-3 p-4 overflow-auto">
          {sortedWords.map((w, i) => (
            <span
              key={w.word}
              className="inline-block font-bold select-none animate-slide-up"
              style={{
                fontSize: `${getSize(w.count)}px`,
                color: dark
                  ? w.count === max
                    ? "#fde68a"
                    : hashColor(w.word)
                  : hashColor(w.word),
                opacity: 0.85 + (w.count / max) * 0.15,
                transform: `rotate(${(i * 37) % 11 - 5}deg)`,
                animationDelay: `${i * 30}ms`,
                textShadow: dark ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
              }}
              title={`${w.word} · ${w.count}次`}
            >
              {w.word}
              <span
                className="ml-1 font-medium opacity-60"
                style={{ fontSize: `${0.5 * getSize(w.count)}px` }}
              >
                {w.count}
              </span>
            </span>
          ))}
        </div>
      )}
      {sortedWords.length > 0 && (
        <div className={`text-xs ${dark ? "text-white/60" : "text-slate-400"} text-center`}>
          共收到 <span className="font-semibold">{sortedWords.reduce((s, w) => s + w.count, 0)}</span> 个关键词 ·{" "}
          <span className="font-semibold">{sortedWords.length}</span> 个不同词汇
        </div>
      )}
    </div>
  );
}
