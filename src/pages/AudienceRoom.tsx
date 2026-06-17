import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Sparkles,
  Users,
  Pause,
  LogOut,
  Check,
  Send,
  Cloud,
  Vote,
  SlidersHorizontal,
  MessageCircle,
  ChevronRight,
  Home,
} from "lucide-react";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";
import { useAudienceId } from "../store/useAppStore";
import type {
  Slide,
  InteractiveComponent,
  PollConfig,
  WordcloudConfig,
  RatingConfig,
  QnaConfig,
  PollResult,
  RatingResult,
  WordEntry,
  AudienceQuestion,
} from "../../shared/types";

export default function AudienceRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const audienceId = useAudienceId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [ended, setEnded] = useState(false);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState<Slide | null>(null);
  const [paused, setPaused] = useState(false);
  const [components, setComponents] = useState<InteractiveComponent[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult>>({});
  const [wordclouds, setWordclouds] = useState<Record<string, WordEntry[]>>({});
  const [ratingResults, setRatingResults] = useState<Record<string, RatingResult>>({});
  const [myPollSelections, setMyPollSelections] = useState<Record<string, number[]>>({});
  const [myRating, setMyRating] = useState<Record<string, number>>({});
  const [myQuestion, setMyQuestion] = useState("");
  const [questionSent, setQuestionSent] = useState(false);

  const hasInteractive = components.length > 0;

  useEffect(() => {
    if (!code) return;
    loadRoom(code);
  }, [code]);

  useEffect(() => {
    if (!socket || !joined) return;
    socket.on("slide:changed", (data: any) => {
      setCurrentSlide(data.slide);
      setComponents(data.interactiveComponents ?? []);
      setMyPollSelections({});
      setMyRating({});
      setQuestionSent(false);
      setMyQuestion("");
    });
    socket.on("presentation:paused", (data: any) => setPaused(data.paused));
    socket.on("presentation:ended", () => {
      setEnded(true);
    });
    socket.on("poll:update", (data: { componentId: string; results: PollResult }) =>
      setPollResults((p) => ({ ...p, [data.componentId]: data.results })),
    );
    socket.on("wordcloud:update", (data: { componentId: string; words: WordEntry[] }) =>
      setWordclouds((p) => ({ ...p, [data.componentId]: data.words })),
    );
    socket.on("rating:update", (data: { componentId: string; results: RatingResult }) =>
      setRatingResults((p) => ({ ...p, [data.componentId]: data.results })),
    );
    socket.on("error", (data: any) => setError(data.message));
    return () => {
      ["slide:changed", "presentation:paused", "presentation:ended", "poll:update", "wordcloud:update", "rating:update", "error"].forEach(
        (e) => socket.off(e),
      );
    };
  }, [socket, joined]);

  async function loadRoom(roomCode: string) {
    setLoading(true);
    setError("");
    try {
      const info = await api.getPresentationByRoomCode(roomCode);
      setPresentationId(info.presentationId);
      setCurrentSlide(info.currentSlide);
      setComponents(info.interactiveComponents);
      setPaused(info.paused);
      socket.emit("audience:join", { roomCode, audienceId });
      setJoined(true);
    } catch (e) {
      setError((e as Error).message || "房间不存在或已关闭");
    }
    setLoading(false);
  }

  function submitPoll(cid: string, cfg: PollConfig, indices: number[]) {
    if (!code) return;
    setMyPollSelections((p) => ({ ...p, [cid]: indices }));
    socket.emit("audience:submitPoll", {
      roomCode: code,
      componentId: cid,
      optionIndices: indices,
    });
  }

  function submitWord(cid: string, word: string) {
    if (!code || !word.trim()) return;
    socket.emit("audience:submitWord", {
      roomCode: code,
      componentId: cid,
      word: word.trim(),
    });
  }

  function submitRating(cid: string, rating: number) {
    if (!code) return;
    setMyRating((p) => ({ ...p, [cid]: rating }));
    socket.emit("audience:submitRating", {
      roomCode: code,
      componentId: cid,
      rating,
    });
  }

  function submitQuestion() {
    if (!code || !myQuestion.trim()) return;
    socket.emit("audience:askQuestion", {
      roomCode: code,
      question: myQuestion.trim(),
    });
    setQuestionSent(true);
    setMyQuestion("");
    setTimeout(() => setQuestionSent(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <div className="text-slate-600 animate-pulse-soft">正在进入房间...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-sm animate-slide-up">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center">
            <LogOut className="w-7 h-7" />
          </div>
          <h2 className="font-display text-2xl text-slate-800 mb-2">无法加入</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/audience" className="btn-outline inline-flex items-center gap-1.5">
            <Home className="w-4 h-4" /> 返回输入房间码
          </Link>
        </div>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <div className="card p-10 text-center max-w-md animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center shadow-glow">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-3xl text-slate-800 mb-2">演示已结束</h2>
          <p className="text-slate-500 mb-8">
            感谢您的参与！您的每一次互动都让这场演讲更有意义。
          </p>
          <Link to="/audience" className="btn-primary inline-flex items-center gap-1.5">
            <Home className="w-4 h-4" /> 返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base text-slate-800 truncate leading-tight">
              {currentSlide?.title || "互动房间"}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="font-mono font-bold tracking-wider text-primary-600">{code}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3 text-accent-500" /> 已连接
              </span>
            </div>
          </div>
          <Link to="/audience" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {paused && (
        <div className="bg-yellow-500/90 text-white text-center py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
          <Pause className="w-4 h-4" /> 演示已暂停，耐心等待演讲者继续
        </div>
      )}

      <main className="flex-1 px-4 py-5">
        <div className="max-w-lg mx-auto space-y-4">
          {!hasInteractive ? (
            <div className="card p-10 text-center animate-fade-in">
              <ChevronRight className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="font-display text-xl text-slate-700 mb-2">等待互动</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                演讲者尚未翻到互动页面。
                <br />
                当互动题出现时，会自动在这里显示。
              </p>
              {currentSlide && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">当前页面</p>
                  <p className="font-display text-2xl text-slate-700">{currentSlide.title}</p>
                </div>
              )}
            </div>
          ) : (
            components.map((comp, idx) => (
              <div key={comp.id} className="animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
                {comp.type === "poll" && (
                  <PollInput
                    config={comp.config as PollConfig}
                    selected={myPollSelections[comp.id]}
                    result={pollResults[comp.id]}
                    onSubmit={(indices) => submitPoll(comp.id, comp.config as PollConfig, indices)}
                  />
                )}
                {comp.type === "wordcloud" && (
                  <WordcloudInput
                    config={comp.config as WordcloudConfig}
                    words={wordclouds[comp.id] ?? []}
                    onSubmit={(w) => submitWord(comp.id, w)}
                  />
                )}
                {comp.type === "rating" && (
                  <RatingInput
                    config={comp.config as RatingConfig}
                    selected={myRating[comp.id]}
                    result={ratingResults[comp.id]}
                    onSubmit={(v) => submitRating(comp.id, v)}
                  />
                )}
                {comp.type === "qna" && (
                  <QnaInput
                    config={comp.config as QnaConfig}
                    value={myQuestion}
                    onChange={setMyQuestion}
                    onSubmit={submitQuestion}
                    sent={questionSent}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-[11px] text-slate-400">
        您正在以匿名身份参与互动 · 房间号 {code}
      </footer>
    </div>
  );
}

function PollInput({
  config,
  selected,
  result,
  onSubmit,
}: {
  config: PollConfig;
  selected?: number[];
  result?: PollResult;
  onSubmit: (indices: number[]) => void;
}) {
  const [local, setLocal] = useState<number[]>(selected ?? []);
  const submitted = selected && selected.length > 0;

  function toggle(i: number) {
    if (submitted) return;
    if (config.multiSelect) {
      setLocal((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]));
    } else {
      setLocal([i]);
      onSubmit([i]);
    }
  }

  const total = result?.totalResponses ?? 0;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip bg-primary-100 text-primary-700">
          <Vote className="w-3.5 h-3.5" /> 投票
        </span>
        {submitted && (
          <span className="chip bg-green-100 text-green-700">
            <Check className="w-3 h-3" /> 已提交
          </span>
        )}
        {config.multiSelect && <span className="text-xs text-slate-400">多选</span>}
      </div>
      <h3 className="font-display text-xl text-slate-800 mb-4 leading-tight">
        {config.question}
      </h3>
      <div className="space-y-2.5">
        {config.options.map((opt, i) => {
          const isSel = local.includes(i);
          const pct = result?.optionPercentages[i] ?? 0;
          const cnt = result?.optionCounts[i] ?? 0;
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={submitted && !config.multiSelect}
              className={`relative w-full overflow-hidden rounded-xl border-2 p-4 text-left transition-all group ${
                submitted
                  ? isSel
                    ? "border-primary-400 bg-primary-50"
                    : "border-slate-100 bg-white"
                  : isSel
                  ? "border-primary-500 bg-primary-50 shadow-md shadow-primary-100"
                  : "border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/30"
              }`}
            >
              {submitted && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-primary-100/70 to-accent-100/40 origin-left transition-all duration-700"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      isSel
                        ? "border-primary-500 bg-primary-500 text-white"
                        : "border-slate-300 group-hover:border-primary-400"
                    }`}
                  >
                    {isSel && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className={`font-medium ${isSel ? "text-primary-700" : "text-slate-700"}`}
                  >
                    {opt}
                  </span>
                </div>
                {submitted && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-700">{pct}%</div>
                    <div className="text-[10px] text-slate-400">{cnt} 票</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {config.multiSelect && !submitted && (
        <button
          onClick={() => local.length > 0 && onSubmit(local)}
          disabled={local.length === 0}
          className="mt-4 btn-primary w-full py-2.5 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> 提交选择
        </button>
      )}
      {total > 0 && (
        <div className="mt-4 text-center text-xs text-slate-400">
          已有 <span className="font-semibold text-slate-600">{total}</span> 人投票
        </div>
      )}
    </div>
  );
}

function WordcloudInput({
  config,
  words,
  onSubmit,
}: {
  config: WordcloudConfig;
  words: WordEntry[];
  onSubmit: (w: string) => void;
}) {
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState(false);

  function submit() {
    if (!value.trim()) return;
    onSubmit(value);
    setFlash(true);
    setValue("");
    setTimeout(() => setFlash(false), 700);
  }

  const totalCount = words.reduce((s, w) => s + w.count, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip bg-accent-100 text-accent-700">
          <Cloud className="w-3.5 h-3.5" /> 关键词云
        </span>
        {flash && (
          <span className="chip bg-green-100 text-green-700 animate-pulse-soft">
            <Check className="w-3 h-3" /> 已提交
          </span>
        )}
      </div>
      <h3 className="font-display text-xl text-slate-800 mb-4 leading-tight">
        {config.prompt}
      </h3>
      <div className="flex gap-2 mb-5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={20}
          placeholder="输入关键词（最多20字）"
          className="input-field flex-1"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="btn-secondary px-4 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {words.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 min-h-[80px]">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
            实时词云预览
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {words
              .sort((a, b) => b.count - a.count)
              .slice(0, 30)
              .map((w, i) => {
                const max = Math.max(...words.map((x) => x.count));
                const size = 12 + (w.count / max) * 18;
                return (
                  <span
                    key={w.word}
                    className="font-bold text-primary-700 animate-fade-in"
                    style={{
                      fontSize: `${size}px`,
                      opacity: 0.6 + (w.count / max) * 0.4,
                      animationDelay: `${i * 20}ms`,
                    }}
                  >
                    {w.word}
                    <span className="ml-0.5 text-[10px] text-slate-400 font-medium opacity-80">
                      ×{w.count}
                    </span>
                  </span>
                );
              })}
          </div>
          <div className="mt-3 text-center text-xs text-slate-400">
            共收到 <span className="font-semibold text-slate-600">{totalCount}</span> 个关键词
          </div>
        </div>
      )}
    </div>
  );
}

function RatingInput({
  config,
  selected,
  result,
  onSubmit,
}: {
  config: RatingConfig;
  selected?: number;
  result?: RatingResult;
  onSubmit: (v: number) => void;
}) {
  const [local, setLocal] = useState<number | null>(selected ?? null);

  function select(v: number) {
    setLocal(v);
    onSubmit(v);
  }

  const total = result?.totalResponses ?? 0;
  const avg = result?.average ?? 0;
  void useMemo;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip bg-highlight-100 text-highlight-700">
          <SlidersHorizontal className="w-3.5 h-3.5" /> 评分
        </span>
        {selected !== undefined && (
          <span className="chip bg-green-100 text-green-700">
            <Check className="w-3 h-3" /> 已评分 {selected} 分
          </span>
        )}
      </div>
      <h3 className="font-display text-xl text-slate-800 mb-4 leading-tight">
        {config.title}
      </h3>

      <div className="space-y-4 mb-5">
        <div className="flex items-center justify-between gap-1">
          {Array.from({ length: Math.floor((config.max - config.min) / config.step) + 1 }, (_, i) => {
            const v = config.min + i * config.step;
            const active = local !== null && v <= local;
            return (
              <button
                key={i}
                onClick={() => select(v)}
                className={`flex-1 aspect-square rounded-xl border-2 transition-all flex items-center justify-center font-bold text-sm ${
                  selected !== undefined
                    ? active
                      ? "border-highlight-400 bg-gradient-to-br from-highlight-300 to-highlight-500 text-white shadow-md"
                      : "border-slate-100 text-slate-400"
                    : active
                    ? "border-highlight-500 bg-highlight-50 text-highlight-600 scale-105 shadow-md"
                    : "border-slate-200 text-slate-600 hover:border-highlight-400 hover:bg-highlight-50 hover:text-highlight-600"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 px-1">
          <span>{config.minLabel || `${config.min}分`}</span>
          <span>{config.maxLabel || `${config.max}分`}</span>
        </div>
      </div>

      {total > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-highlight-50 to-white border border-highlight-100 text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">实时平均分</div>
          <div className="font-display text-3xl bg-gradient-to-br from-highlight-500 to-highlight-600 bg-clip-text text-transparent leading-tight">
            {avg.toFixed(2)}
            <span className="text-base text-slate-400 ml-1">/ {config.max}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            共 {total} 人评分
          </div>
        </div>
      )}
    </div>
  );
}

function QnaInput({
  config,
  value,
  onChange,
  onSubmit,
  sent,
}: {
  config: QnaConfig;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  sent: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip bg-purple-100 text-purple-700">
          <MessageCircle className="w-3.5 h-3.5" /> 提问
        </span>
        {sent && (
          <span className="chip bg-green-100 text-green-700 animate-pulse-soft">
            <Check className="w-3 h-3" /> 问题已提交
          </span>
        )}
        {config.anonymous && (
          <span className="chip bg-slate-100 text-slate-500 ml-auto">匿名</span>
        )}
      </div>
      <h3 className="font-display text-xl text-slate-800 mb-4 leading-tight">
        {config.prompt}
      </h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder="请输入您的问题...（演讲者将选择性展示）"
        className="input-field resize-none"
      />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400">{value.length}/500</span>
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="btn-primary px-5 py-2 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> 提交问题
        </button>
      </div>
    </div>
  );
}
