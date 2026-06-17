import { MessageCircle, CheckCircle, Eye } from "lucide-react";
import type { QnaConfig, AudienceQuestion } from "../../../shared/types";

interface Props {
  config: QnaConfig;
  questions?: AudienceQuestion[];
  shownQuestion?: AudienceQuestion | null;
  dark?: boolean;
  compact?: boolean;
}

export default function QnaDisplay({
  config,
  questions = [],
  shownQuestion,
  dark = false,
  compact = false,
}: Props) {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-4">
      <h3
        className={`font-display text-xl md:text-2xl leading-tight ${dark ? "text-white" : "text-slate-800"}`}
      >
        {config.prompt}
      </h3>
      {shownQuestion ? (
        <div
          className={`flex-1 flex items-center justify-center p-6 rounded-2xl animate-slide-up ${
            dark
              ? "bg-gradient-to-br from-white/10 to-white/5 border border-white/20"
              : "bg-gradient-to-br from-accent-50 to-white border-2 border-accent-200"
          }`}
        >
          <div className="text-center max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/20 text-accent-500 text-xs font-semibold">
              <Eye className="w-3 h-3" /> 观众提问
            </div>
            <p
              className={`font-display text-2xl md:text-3xl leading-relaxed ${dark ? "text-white" : "text-slate-800"}`}
            >
              “{shownQuestion.content}”
            </p>
          </div>
        </div>
      ) : !compact ? (
        <div
          className={`flex-1 min-h-0 overflow-auto space-y-2.5 scrollbar-thin pr-1`}
        >
          {questions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div
                className={`text-sm ${dark ? "text-white/60" : "text-slate-400"} animate-pulse-soft`}
              >
                等待观众提问...
              </div>
            </div>
          ) : (
            questions
              .filter((q) => q.isShown || !compact)
              .slice(0, compact ? 1 : 20)
              .map((q, i) => (
                <div
                  key={q.id}
                  className={`p-3.5 rounded-xl flex items-start gap-3 animate-slide-up ${
                    dark
                      ? "bg-white/8 border border-white/10"
                      : "bg-slate-50 border border-slate-100"
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      dark ? "bg-white/10" : "bg-white"
                    }`}
                  >
                    <MessageCircle
                      className={`w-4 h-4 ${dark ? "text-accent-300" : "text-accent-500"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-relaxed ${dark ? "text-white/90" : "text-slate-700"}`}
                    >
                      {q.content}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {q.isShown && (
                        <span className="chip bg-accent-100 text-accent-700">
                          <Eye className="w-3 h-3" /> 已展示
                        </span>
                      )}
                      {q.isAnswered && (
                        <span className="chip bg-primary-100 text-primary-700">
                          <CheckCircle className="w-3 h-3" /> 已回答
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-400"}`}>
            暂无可展示问题
          </div>
        </div>
      )}
      {!compact && questions.length > 0 && (
        <div className={`text-xs ${dark ? "text-white/60" : "text-slate-400"} text-center`}>
          共收到 <span className="font-semibold">{questions.length}</span> 条提问
        </div>
      )}
    </div>
  );
}
