import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  BarChart3,
  ArrowLeft,
  Download,
  FileText,
  Users,
  Sparkles,
  Vote,
  Cloud,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import { api } from "../api/client";
import type {
  ReportData,
  PollResult,
  RatingResult,
  WordEntry,
  AudienceQuestion,
  InteractiveComponent,
  PollConfig,
  WordcloudConfig,
  RatingConfig,
  QnaConfig,
} from "../../shared/types";
import PollDisplay from "../components/interactive/PollDisplay";
import WordcloudDisplay from "../components/interactive/WordcloudDisplay";
import RatingDisplay from "../components/interactive/RatingDisplay";
import QnaDisplay from "../components/interactive/QnaDisplay";

interface FlattenedReportComponent {
  slideIndex: number;
  slideTitle: string;
  componentId: string;
  type: "poll" | "wordcloud" | "rating" | "qna";
  prompt: string;
  config: PollConfig | WordcloudConfig | RatingConfig | QnaConfig;
  results: PollResult | WordEntry[] | RatingResult | { questions: AudienceQuestion[] };
}

export default function Report() {
  const { presentationId, sessionId } = useParams<{ presentationId: string; sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!presentationId || !sessionId) return;
    loadReport();
  }, [presentationId, sessionId]);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await api.getReport(presentationId!, sessionId!);
      setReport(data);
    } catch (e) {
      setError((e as Error).message || "报告加载失败");
    }
    setLoading(false);
  }

  function exportCsv() {
    if (!presentationId || !sessionId) return;
    api.exportCsv(presentationId, sessionId);
  }

  const { flattenedComponents, stats } = useMemo(() => {
    if (!report) return { flattenedComponents: [], stats: null };

    const findConfig = (cid: string): InteractiveComponent["config"] | null => {
      for (const slide of report.presentation.slides) {
        const comp = slide.components.find((c) => c.id === cid);
        if (comp) return comp.config;
      }
      return null;
    };

    const flattened: FlattenedReportComponent[] = [];
    for (const s of report.slidesReport) {
      for (const c of s.components) {
        const cfg = findConfig(c.componentId);
        if (cfg) {
          flattened.push({
            slideIndex: s.slideIndex,
            slideTitle: s.slideTitle,
            componentId: c.componentId,
            type: c.type,
            prompt: c.prompt,
            config: cfg,
            results: c.results,
          });
        }
      }
    }

    const polls = flattened.filter((c) => c.type === "poll");
    const words = flattened.filter((c) => c.type === "wordcloud");
    const ratings = flattened.filter((c) => c.type === "rating");
    const qnas = flattened.filter((c) => c.type === "qna");

    const avgPollParticipation =
      polls.length > 0
        ? Math.round(
            polls.reduce((s, p) => s + (p.results as PollResult).totalResponses, 0) / polls.length,
          )
        : 0;

    const totalQuestions = qnas.reduce(
      (s, q) => s + ((q.results as { questions: AudienceQuestion[] }).questions?.length ?? 0),
      0,
    );
    const answeredQuestions = qnas.reduce(
      (s, q) =>
        s +
        ((q.results as { questions: AudienceQuestion[] }).questions?.filter((x) => x.isAnswered)
          .length ??
          0),
      0,
    );

    const avgRating =
      ratings.length > 0
        ? ratings.reduce((s, r) => s + (r.results as RatingResult).average, 0) / ratings.length
        : 0;

    return {
      flattenedComponents: flattened,
      stats: {
        polls,
        words,
        ratings,
        qnas,
        totalParticipants: report.totalAudience,
        avgPollParticipation,
        totalQuestions,
        answeredQuestions,
        avgRating,
      },
    };
  }, [report]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="text-slate-600 animate-pulse-soft">正在生成报告...</div>
      </div>
    );
  }

  if (error || !report || !stats) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md animate-slide-up">
          <h2 className="font-display text-2xl text-slate-800 mb-2">加载失败</h2>
          <p className="text-slate-500 mb-6">{error || "找不到该报告"}</p>
          <Link to="/" className="btn-outline inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> 返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl text-slate-800 leading-tight truncate">
              {report.presentation.title}
            </h1>
            <div className="text-xs text-slate-500">
              互动数据报告 · 会话 {report.session.id.slice(0, 6)} ·{" "}
              {new Date(report.session.startedAt).toLocaleString()}
            </div>
          </div>
          <button
            onClick={exportCsv}
            className="btn-primary py-2.5 px-5 inline-flex items-center gap-1.5 text-sm"
          >
            <Download className="w-4 h-4" /> 导出数据
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            color="primary"
            label="参与观众"
            value={stats.totalParticipants}
          />
          <StatCard
            icon={<Vote className="w-5 h-5" />}
            color="accent"
            label="投票题数"
            value={stats.polls.length}
            sub={`平均 ${stats.avgPollParticipation} 人/题`}
          />
          <StatCard
            icon={<SlidersHorizontal className="w-5 h-5" />}
            color="highlight"
            label="评分题数"
            value={stats.ratings.length}
            sub={stats.ratings.length > 0 ? `平均 ${stats.avgRating.toFixed(2)} 分` : undefined}
          />
          <StatCard
            icon={<MessageCircle className="w-5 h-5" />}
            color="purple"
            label="问答数量"
            value={stats.totalQuestions}
            sub={`已回答 ${stats.answeredQuestions}`}
          />
        </section>

        <section>
          <h2 className="font-display text-2xl text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" /> 互动题详情
          </h2>
          <div className="space-y-6">
            {flattenedComponents.map((comp, idx) => (
              <div
                key={comp.componentId}
                className="card p-6 animate-slide-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-xs text-slate-400 font-bold">SLIDE</span>
                      <span className="font-display text-2xl text-primary-600 leading-none">
                        {comp.slideIndex + 1}
                      </span>
                    </div>
                    <div>
                      {comp.type === "poll" && (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="chip bg-primary-100 text-primary-700">
                              <Vote className="w-3 h-3" /> 选择题投票
                            </span>
                            {(comp.config as PollConfig).multiSelect && (
                              <span className="chip bg-slate-100 text-slate-500">多选</span>
                            )}
                          </div>
                          <h3 className="font-display text-lg text-slate-800 leading-tight">
                            {comp.prompt}
                          </h3>
                        </>
                      )}
                      {comp.type === "wordcloud" && (
                        <>
                          <div className="mb-1">
                            <span className="chip bg-accent-100 text-accent-700">
                              <Cloud className="w-3 h-3" /> 词云
                            </span>
                          </div>
                          <h3 className="font-display text-lg text-slate-800 leading-tight">
                            {comp.prompt}
                          </h3>
                        </>
                      )}
                      {comp.type === "rating" && (
                        <>
                          <div className="mb-1">
                            <span className="chip bg-highlight-100 text-highlight-700">
                              <SlidersHorizontal className="w-3 h-3" /> 评分
                            </span>
                          </div>
                          <h3 className="font-display text-lg text-slate-800 leading-tight">
                            {comp.prompt}
                          </h3>
                        </>
                      )}
                      {comp.type === "qna" && (
                        <>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="chip bg-purple-100 text-purple-700">
                              <MessageCircle className="w-3 h-3" /> 问答
                            </span>
                            {(comp.config as QnaConfig).anonymous && (
                              <span className="chip bg-slate-100 text-slate-500">匿名</span>
                            )}
                          </div>
                          <h3 className="font-display text-lg text-slate-800 leading-tight">
                            {comp.prompt}
                          </h3>
                        </>
                      )}
                      <p className="text-xs text-slate-400 mt-1">所属页面：{comp.slideTitle}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {comp.type === "poll" && (
                      <>
                        <div className="font-display text-3xl text-primary-600 leading-tight">
                          {(comp.results as PollResult).totalResponses}
                        </div>
                        <div className="text-xs text-slate-400">投票人次</div>
                      </>
                    )}
                    {comp.type === "wordcloud" && (
                      <>
                        <div className="font-display text-3xl text-accent-600 leading-tight">
                          {(comp.results as WordEntry[]).reduce((s, w) => s + w.count, 0)}
                        </div>
                        <div className="text-xs text-slate-400">关键词数</div>
                      </>
                    )}
                    {comp.type === "rating" && (
                      <>
                        <div className="font-display text-3xl text-highlight-600 leading-tight">
                          {(comp.results as RatingResult).average.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-400">平均分</div>
                      </>
                    )}
                    {comp.type === "qna" && (
                      <>
                        <div className="flex items-center justify-end gap-3">
                          <div>
                            <div className="font-display text-2xl text-purple-600 leading-tight">
                              {(comp.results as { questions: AudienceQuestion[] }).questions.length}
                            </div>
                            <div className="text-[10px] text-slate-400">总问题</div>
                          </div>
                          <div>
                            <div className="font-display text-2xl text-green-600 leading-tight">
                              {
                                (comp.results as { questions: AudienceQuestion[] }).questions.filter(
                                  (q) => q.isAnswered,
                                ).length
                              }
                            </div>
                            <div className="text-[10px] text-slate-400">已回答</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  {comp.type === "poll" && (
                    <PollDisplay
                      config={comp.config as PollConfig}
                      result={comp.results as PollResult}
                    />
                  )}
                  {comp.type === "wordcloud" && (
                    <WordcloudDisplay
                      config={comp.config as WordcloudConfig}
                      words={comp.results as WordEntry[]}
                    />
                  )}
                  {comp.type === "rating" && (
                    <RatingDisplay
                      config={comp.config as RatingConfig}
                      result={comp.results as RatingResult}
                    />
                  )}
                  {comp.type === "qna" && (
                    <QnaDisplay
                      config={comp.config as QnaConfig}
                      questions={(comp.results as { questions: AudienceQuestion[] }).questions}
                      shownQuestion={null}
                      compact
                    />
                  )}
                </div>

                {comp.type === "poll" && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">详细分布</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {(comp.config as PollConfig).options.map((opt, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white border border-slate-100">
                          <div className="text-sm font-medium text-slate-700 truncate">{opt}</div>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="font-display text-xl text-primary-600">
                              {(comp.results as PollResult).optionPercentages[i]}%
                            </span>
                            <span className="text-xs text-slate-400">
                              ({(comp.results as PollResult).optionCounts[i]} 票)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comp.type === "wordcloud" && (comp.results as WordEntry[]).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">关键词排名 TOP 10</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(comp.results as WordEntry[])
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10)
                        .map((w, i) => (
                          <div
                            key={w.word}
                            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-accent-50 to-primary-50 border border-accent-100 text-sm"
                          >
                            <span className="text-xs text-slate-400 font-bold mr-1">#{i + 1}</span>
                            <span className="font-semibold text-slate-700">{w.word}</span>
                            <span className="ml-1.5 text-accent-600 font-bold">×{w.count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {comp.type === "rating" && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-white border border-slate-100">
                        <div className="text-xs text-slate-400 mb-1">最高分</div>
                        <div className="font-display text-xl text-highlight-600">
                          {(comp.results as RatingResult).max}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-100">
                        <div className="text-xs text-slate-400 mb-1">最低分</div>
                        <div className="font-display text-xl text-highlight-600">
                          {(comp.results as RatingResult).min}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-100">
                        <div className="text-xs text-slate-400 mb-1">参与人数</div>
                        <div className="font-display text-xl text-highlight-600">
                          {(comp.results as RatingResult).totalResponses}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {flattenedComponents.length === 0 && (
              <div className="card p-10 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">本次演示未包含互动组件</p>
              </div>
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 pb-8 pt-4">
          报告由 LiveDeck 互动演示系统自动生成 ·{" "}
          {new Date(report.session.endedAt || Date.now()).toLocaleString()}
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: "primary" | "accent" | "highlight" | "purple";
  label: string;
  value: number;
  sub?: string;
}) {
  const colors: Record<string, string> = {
    primary: "from-primary-500 to-primary-700",
    accent: "from-accent-500 to-accent-700",
    highlight: "from-highlight-500 to-highlight-700",
    purple: "from-purple-500 to-purple-700",
  };
  const bgColors: Record<string, string> = {
    primary: "bg-primary-50 text-primary-600",
    accent: "bg-accent-50 text-accent-600",
    highlight: "bg-highlight-50 text-highlight-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <span className={`p-2.5 rounded-xl ${bgColors[color]}`}>{icon}</span>
      </div>
      <div
        className={`font-display text-3xl bg-gradient-to-br ${colors[color]} bg-clip-text text-transparent leading-tight`}
      >
        {value}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
