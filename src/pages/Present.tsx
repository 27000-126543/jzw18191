import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Users,
  MessageSquare,
  Eye,
  CheckCircle,
  QrCode,
  X,
  BarChart2,
  LogOut,
  LayoutDashboard,
  Activity,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api/client";
import { useLiveStore } from "../store/useAppStore";
import { useSocket } from "../hooks/useSocket";
import type {
  Presentation,
  AudienceQuestion,
  PollResult,
  RatingResult,
  WordEntry,
} from "../../shared/types";
import SlideCanvas from "../components/SlideCanvas";

export default function Present() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [showQuestionPanel, setShowQuestionPanel] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"qna" | "console">("console");
  const [selectedQnaId, setSelectedQnaId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSlideIndex = useLiveStore((s) => s.currentSlideIndex);
  const paused = useLiveStore((s) => s.paused);
  const roomCode = useLiveStore((s) => s.roomCode);
  const sessionId = useLiveStore((s) => s.sessionId);
  const audienceCount = useLiveStore((s) => s.audienceCount);
  const pollResults = useLiveStore((s) => s.pollResults);
  const wordclouds = useLiveStore((s) => s.wordclouds);
  const ratingResults = useLiveStore((s) => s.ratingResults);
  const questions = useLiveStore((s) => s.questions);
  const shownQuestion = useLiveStore((s) => s.shownQuestion);
  const setLive = useLiveStore((s) => s.setLive);
  const addPollResult = useLiveStore((s) => s.addPollResult);
  const addWordcloud = useLiveStore((s) => s.addWordcloud);
  const addRatingResult = useLiveStore((s) => s.addRatingResult);
  const addQuestion = useLiveStore((s) => s.addQuestion);
  const markQuestionShown = useLiveStore((s) => s.markQuestionShown);
  const markQuestionAnswered = useLiveStore((s) => s.markQuestionAnswered);

  const currentSlide = presentation?.slides[currentSlideIndex];
  const totalSlides = presentation?.slides.length ?? 0;
  const currentQnaComponents = currentSlide?.components.filter((c) => c.type === "qna") ?? [];
  const currentQnaIds = currentQnaComponents.map((c) => c.id);
  const effectiveQnaId = selectedQnaId && currentQnaIds.includes(selectedQnaId) ? selectedQnaId : (currentQnaIds[0] ?? null);
  const currentQuestions = questions.filter((q) => effectiveQnaId ? q.componentId === effectiveQnaId : currentQnaIds.includes(q.componentId));

  const liveData = useMemo(
    () => ({ pollResults, wordclouds, ratingResults, questions, shownQuestion }),
    [pollResults, wordclouds, ratingResults, questions, shownQuestion],
  );

  useEffect(() => {
    if (!id) return;
    loadAndStart(id);
    return () => {
      socket.offAny();
    };
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.on("presenter:joined", (data: any) => {
      setLive({
        roomCode: data.roomCode,
        sessionId: data.sessionId,
        currentSlideIndex: data.currentSlide,
        paused: data.paused,
      });
    });
    socket.on("presenter:navigated", (data: any) => {
      setLive({ currentSlideIndex: data.slideIndex });
    });
    socket.on("presentation:paused", (data: any) => setLive({ paused: data.paused }));
    socket.on("presentation:ended", (data: any) => {
      const sid = data?.sessionId || sessionId;
      if (sid && id) {
        navigate(`/report/${id}/${sid}`);
      }
    });
    socket.on("audience:count", (data: any) => setLive({ audienceCount: data.count }));
    socket.on("poll:update", (data: { componentId: string; results: PollResult }) =>
      addPollResult(data.componentId, data.results),
    );
    socket.on("wordcloud:update", (data: { componentId: string; words: WordEntry[] }) =>
      addWordcloud(data.componentId, data.words),
    );
    socket.on("rating:update", (data: { componentId: string; results: RatingResult }) =>
      addRatingResult(data.componentId, data.results),
    );
    socket.on("question:new", (data: { question: AudienceQuestion }) => addQuestion(data.question));
    socket.on("question:show", (data: { question: AudienceQuestion }) =>
      markQuestionShown(data.question.id),
    );
    socket.on("question:answered", (data: { questionId: string }) => markQuestionAnswered(data.questionId));
    socket.on("error", (data: any) => alert(data.message));

    return () => {
      [
        "presenter:joined",
        "presenter:navigated",
        "presentation:paused",
        "presentation:ended",
        "audience:count",
        "poll:update",
        "wordcloud:update",
        "rating:update",
        "question:new",
        "question:show",
        "question:answered",
        "error",
      ].forEach((evt) => socket.off(evt));
    };
  }, [socket, id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key.toLowerCase() === "p") togglePause();
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentSlideIndex, paused, totalSlides]);

  async function loadAndStart(pid: string) {
    setLoading(true);
    try {
      const [p, active] = await Promise.all([
        api.getPresentation(pid),
        api.getActiveSession(pid).catch(() => null),
      ]);
      setPresentation(p);
      let session = active;
      if (!session) {
        setStarting(true);
        session = await api.startSession(pid);
      }
      setLive({
        roomCode: session.roomCode,
        sessionId: session.id,
        currentSlideIndex: session.currentSlide,
        paused: session.paused,
        audienceCount: session.audienceIds.length,
        questions: session.questions,
        pollResults: {},
        wordclouds: session.words ?? {},
        ratingResults: {},
      });
      socket.emit("presenter:join", { presentationId: pid });
    } catch (e) {
      alert("启动失败：" + (e as Error).message);
      navigate("/");
    }
    setStarting(false);
    setLoading(false);
  }

  function goNext() {
    if (paused || !presentation || !id) return;
    if (currentSlideIndex >= totalSlides - 1) return;
    const next = currentSlideIndex + 1;
    socket.emit("presenter:navigate", { presentationId: id, slideIndex: next });
    setLive({ currentSlideIndex: next });
  }
  function goPrev() {
    if (!presentation || !id) return;
    if (currentSlideIndex <= 0) return;
    const prev = currentSlideIndex - 1;
    socket.emit("presenter:navigate", { presentationId: id, slideIndex: prev });
    setLive({ currentSlideIndex: prev });
  }
  function goTo(idx: number) {
    if (!id) return;
    socket.emit("presenter:navigate", { presentationId: id, slideIndex: idx });
    setLive({ currentSlideIndex: idx });
  }
  function togglePause() {
    if (!id) return;
    const np = !paused;
    socket.emit("presenter:pause", { presentationId: id, paused: np });
    setLive({ paused: np });
  }
  function toggleFullscreen() {
    const el = containerRef.current;
    if (!fullscreen && el) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  async function endPresentation() {
    if (!id || !confirm("确认结束本次演示？将跳转至数据报告页面")) return;
    try {
      const res = await api.endSession(id);
      const sid = res.sessionId || sessionId;
      if (sid) {
        socket.emit("presenter:end", { presentationId: id, sessionId: sid });
        navigate(`/report/${id}/${sid}`);
      } else {
        navigate("/");
      }
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function handleShowQuestion(qid: string) {
    if (!id) return;
    socket.emit("presenter:showQuestion", { presentationId: id, questionId: qid });
    markQuestionShown(qid);
  }
  function handleMarkAnswered(qid: string) {
    if (!id) return;
    socket.emit("presenter:markAnswered", { presentationId: id, questionId: qid });
    markQuestionAnswered(qid);
  }

  const audienceUrl = roomCode ? `${window.location.origin}/audience/${roomCode}` : "";

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mesh">
        <div className="text-slate-600 animate-pulse-soft">
          {starting ? "正在创建演示房间..." : "正在加载演示..."}
        </div>
      </div>
    );
  }

  if (!presentation || !currentSlide) return null;

  return (
    <div
      ref={containerRef}
      className={`h-screen flex flex-col bg-slate-900 text-white overflow-hidden ${
        fullscreen ? "fullscreen-mode" : ""
      }`}
    >
      {!fullscreen && (
        <header className="h-14 shrink-0 bg-slate-800/90 backdrop-blur-xl border-b border-white/10 flex items-center px-4 gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg truncate">{presentation.title}</div>
            <div className="text-xs text-white/50">
              第 {currentSlideIndex + 1} / {totalSlides} 页
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm">
            <Users className="w-4 h-4 text-accent-400" />
            <span className="font-semibold">{audienceCount}</span>
            <span className="text-white/50 text-xs">观众在线</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/20 border border-primary-400/30 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            房间号：<span className="font-mono font-bold tracking-widest">{roomCode}</span>
          </div>
          <button
            onClick={() => setShowQR(!showQR)}
            className={`p-2 rounded-lg transition ${
              showQR ? "bg-white/15" : "hover:bg-white/10"
            }`}
            title="二维码"
          >
            <QrCode className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowQuestionPanel(!showQuestionPanel)}
            className={`p-2 rounded-lg transition ${
              showQuestionPanel ? "bg-white/15" : "hover:bg-white/10"
            }`}
            title="问答面板"
          >
            <MessageSquare className="w-5 h-5" />
            {currentQuestions.filter((q) => !q.isAnswered).length > 0 && (
              <span className="absolute -mt-6 ml-3 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 font-bold">
                {currentQuestions.filter((q) => !q.isAnswered).length}
              </span>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10"
            title="全屏 (F)"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={endPresentation}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-500/80 hover:bg-red-500 flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            结束演示
          </button>
        </header>
      )}

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          {showQR && !fullscreen && roomCode && (
            <div className="absolute top-4 right-4 z-10 p-3 bg-white rounded-2xl shadow-2xl animate-slide-up">
              <button
                onClick={() => setShowQR(false)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
              <QRCodeSVG value={audienceUrl} size={120} level="H" includeMargin={false} />
              <div className="text-center text-slate-700 mt-2">
                <div className="text-[10px] text-slate-500">扫码或访问</div>
                <div className="font-mono font-bold text-sm text-primary-600">
                  /audience/{roomCode}
                </div>
              </div>
            </div>
          )}

          {paused && (
            <div className="absolute inset-x-0 top-0 z-10 py-2 text-center bg-yellow-500/80 backdrop-blur-sm text-white font-semibold animate-fade-in">
              <Pause className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> 演示已暂停，观众端已锁定
            </div>
          )}

          {shownQuestion && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 max-w-2xl w-[90%] animate-slide-up">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border-2 border-accent-400/50 shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="chip bg-accent-500 text-white text-xs">
                    <Eye className="w-3 h-3" /> 观众提问
                  </span>
                </div>
                <p className="font-display text-2xl text-slate-800 leading-relaxed">
                  “{shownQuestion.content}”
                </p>
              </div>
            </div>
          )}

          <div
            className="w-full max-w-6xl aspect-video relative animate-fade-in"
            style={{
              animationDuration: "300ms",
              animationDelay: `${currentSlideIndex * 30}ms`,
            }}
            key={currentSlide.id}
          >
            <SlideCanvas slide={currentSlide} dark liveData={liveData} />
          </div>
        </main>

        {!fullscreen && showQuestionPanel && (
          <aside className="w-80 shrink-0 bg-slate-800/60 backdrop-blur-xl border-l border-white/10 flex flex-col">
            <div className="p-1 border-b border-white/10 flex gap-1">
              <button
                onClick={() => setSidebarTab("console")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  sidebarTab === "console"
                    ? "bg-primary-500/30 text-primary-300"
                    : "text-white/50 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> 控制台
              </button>
              <button
                onClick={() => setSidebarTab("qna")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  sidebarTab === "qna"
                    ? "bg-accent-500/30 text-accent-300"
                    : "text-white/50 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> 问答
                {currentQuestions.filter((q) => !q.isAnswered).length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {currentQuestions.filter((q) => !q.isAnswered).length}
                  </span>
                )}
              </button>
            </div>

            {sidebarTab === "console" && (
              <ConsolePanel
                currentSlide={currentSlide}
                audienceCount={audienceCount}
                pollResults={pollResults}
                wordclouds={wordclouds}
                ratingResults={ratingResults}
                questions={currentQuestions}
                paused={paused}
              />
            )}

            {sidebarTab === "qna" && (
              <div className="flex-1 min-h-0 flex flex-col">
                {currentQnaComponents.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-white/40 py-10">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                    <p>当前页无问答组件</p>
                    <p className="text-xs opacity-60 mt-1">
                      翻到问答页后，问题将显示在这里
                    </p>
                  </div>
                ) : (
                  <>
                    {currentQnaComponents.length > 1 && (
                      <div className="px-3 py-2 flex gap-1.5 border-b border-white/5 overflow-x-auto scrollbar-thin">
                        {currentQnaComponents.map((comp: any) => {
                          const cfg = comp.config as any;
                          const label = cfg.prompt || cfg.question || cfg.title || `问答 ${currentQnaComponents.indexOf(comp) + 1}`;
                          const count = questions.filter((q: any) => q.componentId === comp.id).length;
                          const isActive = effectiveQnaId === comp.id;
                          return (
                            <button
                              key={comp.id}
                              onClick={() => setSelectedQnaId(comp.id)}
                              className={`px-3 py-1 rounded-lg text-[11px] font-medium shrink-0 transition ${
                                isActive
                                  ? "bg-accent-500/30 text-accent-300 border border-accent-400/30"
                                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                              }`}
                            >
                              {label.length > 12 ? label.slice(0, 12) + "…" : label}
                              {count > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                  isActive ? "bg-accent-500/40" : "bg-white/10"
                                }`}>
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {currentQnaComponents.length > 1 ? "当前组件提问" : "当前页提问"}
                      </span>
                      <span className="chip bg-white/10 text-white/80 text-xs">
                        {currentQuestions.length} 条
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2.5">
                      {currentQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center text-sm text-white/40 py-8">
                          <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                          <p>暂无提问</p>
                        </div>
                      ) : (
                        [...currentQuestions]
                          .sort((a, b) => (b.isShown === a.isShown ? 0 : b.isShown ? 1 : -1))
                          .sort((a, b) => (b.isAnswered === a.isAnswered ? 0 : a.isAnswered ? 1 : -1))
                          .map((q, i) => (
                            <div
                              key={q.id}
                              className={`p-3 rounded-xl animate-slide-up border ${
                                q.isShown
                                  ? "bg-accent-500/15 border-accent-400/40"
                                  : "bg-white/5 border-white/10"
                              } ${q.isAnswered ? "opacity-60" : ""}`}
                              style={{ animationDelay: `${i * 30}ms` }}
                            >
                              <p className="text-sm leading-relaxed text-white/90 mb-2.5">
                                {q.content}
                              </p>
                              <div className="flex gap-1.5 flex-wrap">
                                {!q.isShown && (
                                  <button
                                    onClick={() => handleShowQuestion(q.id)}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-medium flex items-center gap-1 animate-pulse-soft"
                                  >
                                    <Eye className="w-3 h-3" /> 展示
                                  </button>
                                )}
                                {!q.isAnswered && (
                                  <button
                                    onClick={() => handleMarkAnswered(q.id)}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-primary-500/80 hover:bg-primary-500 text-white font-medium flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-3 h-3" /> 已答
                                  </button>
                                )}
                                {q.isShown && (
                                  <span className="text-xs chip bg-accent-500/20 text-accent-300 border border-accent-400/30">
                                    <Eye className="w-3 h-3" /> 展示中
                                  </span>
                                )}
                                {q.isAnswered && (
                                  <span className="text-xs chip bg-primary-500/20 text-primary-300 border border-primary-400/30">
                                    <CheckCircle className="w-3 h-3" /> 已回答
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer
        className={`h-16 shrink-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-3 ${
          fullscreen ? "absolute bottom-4 left-1/2 -translate-x-1/2 h-auto rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-2" : ""
        }`}
      >
        <div className="hidden md:flex items-center gap-1 px-3 py-1 overflow-x-auto max-w-md scrollbar-thin">
          {presentation.slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`w-10 h-10 rounded-lg shrink-0 transition-all ${
                i === currentSlideIndex
                  ? "bg-primary-500 text-white scale-110 shadow-lg shadow-primary-500/40"
                  : "bg-white/5 text-white/60 hover:bg-white/15 hover:text-white"
              } font-bold text-xs`}
              title={`第 ${i + 1} 页`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={goPrev}
          disabled={currentSlideIndex <= 0}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition"
          title="上一页 (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={togglePause}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
            paused
              ? "bg-green-500 hover:bg-green-600"
              : "bg-yellow-500 hover:bg-yellow-600"
          }`}
          title={paused ? "继续 (P)" : "暂停 (P)"}
        >
          {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>
        <button
          onClick={goNext}
          disabled={currentSlideIndex >= totalSlides - 1 || paused}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition"
          title="下一页 (→ / 空格)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        {sessionId && (
          <button
            onClick={() => navigate(`/report/${id}/${sessionId}`)}
            className="ml-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition"
            title="查看实时报告"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
        )}
      </footer>
    </div>
  );
}

function ConsolePanel({
  currentSlide,
  audienceCount,
  pollResults,
  wordclouds,
  ratingResults,
  questions,
  paused,
}: {
  currentSlide: any;
  audienceCount: number;
  pollResults: Record<string, any>;
  wordclouds: Record<string, any[]>;
  ratingResults: Record<string, any>;
  questions: any[];
  paused: boolean;
}) {
  const components = currentSlide?.components ?? [];
  const currentComponentIds = new Set(components.map((c: any) => c.id));
  const currentQuestions = questions.filter((q) => currentComponentIds.has(q.componentId));
  const unansweredCount = currentQuestions.filter((q) => !q.isAnswered).length;
  const recentQuestions = [...currentQuestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  const TARGET_PARTICIPATION_RATE = 0.8;

  const analysis = useMemo(() => {
    let totalGap = 0;
    let totalCurrent = 0;
    let worstCompletionRate = 1;
    let hasHighConsensus = false;
    let hasLowConsensus = false;
    let highConsensusPrompt = "";
    let lowConsensusPrompt = "";
    let maxParticipationRate = 0;

    for (const comp of components) {
      const targetCount = Math.ceil(audienceCount * TARGET_PARTICIPATION_RATE);
      let currentCount = 0;

      if (comp.type === "poll") {
        const r = pollResults[comp.id];
        currentCount = r?.totalResponses ?? 0;
        if (r?.optionCounts && r.totalResponses > 0) {
          const maxCount = Math.max(...Object.values(r.optionCounts) as number[]);
          const ratio = maxCount / r.totalResponses;
          const cfg = comp.config as any;
          if (ratio >= 0.6) {
            hasHighConsensus = true;
            highConsensusPrompt = cfg.prompt || comp.prompt;
          } else if (ratio < 0.4 && r.totalResponses >= 5) {
            hasLowConsensus = true;
            lowConsensusPrompt = cfg.prompt || comp.prompt;
          }
        }
      } else if (comp.type === "wordcloud") {
        currentCount = wordclouds[comp.id]?.length ?? 0;
      } else if (comp.type === "rating") {
        const r = ratingResults[comp.id];
        currentCount = r?.totalResponses ?? 0;
      } else if (comp.type === "qna") {
        const qs = currentQuestions.filter((q) => q.componentId === comp.id);
        currentCount = qs.length;
      }

      totalCurrent += currentCount;
      totalGap += Math.max(0, targetCount - currentCount);
      const rate = audienceCount > 0 ? currentCount / audienceCount : 0;
      maxParticipationRate = Math.max(maxParticipationRate, rate);
      worstCompletionRate = Math.min(worstCompletionRate, rate);
    }

    return { totalGap, totalCurrent, worstCompletionRate, hasHighConsensus, hasLowConsensus, highConsensusPrompt, lowConsensusPrompt, maxParticipationRate };
  }, [components, audienceCount, pollResults, wordclouds, ratingResults, currentQuestions]);

  const suggestion = useMemo(() => {
    if (components.length === 0) return { status: "go", text: "建议翻页", detail: "当前页无互动组件" };
    if (paused) return { status: "warn", text: "已暂停", detail: "请先恢复再翻页" };
    if (unansweredCount >= 3) return { status: "stop", text: "建议等待", detail: `还有 ${unansweredCount} 条提问未处理` };
    if (analysis.totalGap > 0) return { status: "warn", text: "可继续等待", detail: `还差 ${analysis.totalGap} 人参与达到目标` };
    if (analysis.maxParticipationRate < 0.5 && audienceCount >= 5) return { status: "warn", text: "可继续等待", detail: "参与率不足50%" };
    return { status: "go", text: "建议翻页", detail: "数据已稳定，可进入下一页" };
  }, [components, paused, unansweredCount, analysis, audienceCount]);

  const suggestionStyle = {
    go: { bg: "bg-emerald-500/20", border: "border-emerald-400/30", text: "text-emerald-300", icon: <ChevronRight className="w-4 h-4" /> },
    warn: { bg: "bg-amber-500/20", border: "border-amber-400/30", text: "text-amber-300", icon: <Clock className="w-4 h-4" /> },
    stop: { bg: "bg-red-500/20", border: "border-red-400/30", text: "text-red-300", icon: <AlertCircle className="w-4 h-4" /> },
  }[suggestion.status] || { bg: "bg-slate-500/20", border: "border-slate-400/30", text: "text-slate-300", icon: <Info className="w-4 h-4" /> };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-3">
      <div className={`p-3 rounded-xl ${suggestionStyle.bg} border ${suggestionStyle.border}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{suggestionStyle.icon}</span>
          <span className={`text-sm font-bold ${suggestionStyle.text}`}>翻页建议：{suggestion.text}</span>
        </div>
        <p className={`text-xs ${suggestionStyle.text} opacity-80`}>{suggestion.detail}</p>
        {analysis.hasHighConsensus && (
          <p className="text-[10px] text-emerald-300 mt-1.5 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> 「{analysis.highConsensusPrompt}」意见高度集中
          </p>
        )}
        {analysis.hasLowConsensus && (
          <p className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> 「{analysis.lowConsensusPrompt}」存在明显分歧
          </p>
        )}
        {analysis.totalGap > 0 && audienceCount > 0 && (
          <p className="text-[10px] text-white/50 mt-1">
            目标参与率 80%（{Math.ceil(audienceCount * TARGET_PARTICIPATION_RATE)} 人/项），当前缺口 {analysis.totalGap} 人
          </p>
        )}
      </div>

      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-accent-400" />
          <span className="text-sm font-semibold text-white/80">当前页状态</span>
          {paused && (
            <span className="chip bg-yellow-500/20 text-yellow-300 text-[10px] border border-yellow-400/30">
              <Pause className="w-3 h-3" /> 已暂停
            </span>
          )}
        </div>
        <div className="text-xs text-white/40 mb-2">
          在线 <span className="font-bold text-white/70">{audienceCount}</span> 人 · 目标参与率 <span className="font-bold text-white/70">80%</span>
        </div>
        {components.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-3">当前页无互动组件</p>
        ) : (
          <div className="space-y-2">
            {components.map((comp: any) => (
              <ComponentProgressBar
                key={comp.id}
                comp={comp}
                audienceCount={audienceCount}
                pollResults={pollResults}
                wordclouds={wordclouds}
                ratingResults={ratingResults}
                questions={questions}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-purple-400" /> 未处理提问
          </span>
          {unansweredCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-400/30">
              {unansweredCount} 条待处理
            </span>
          )}
        </div>
        {unansweredCount === 0 ? (
          <p className="text-xs text-white/30 text-center py-2">暂无待处理提问</p>
        ) : (
          <div className="space-y-1.5">
            {recentQuestions.filter((q) => !q.isAnswered).map((q) => (
              <div key={q.id} className="p-2 rounded-lg bg-white/5 text-xs text-white/70 leading-relaxed">
                "{q.content.slice(0, 60)}{q.content.length > 60 ? "..." : ""}"
              </div>
            ))}
            {unansweredCount > 3 && (
              <p className="text-[10px] text-white/30 text-center">
                还有 {unansweredCount - 3} 条，切换到问答 Tab 处理
              </p>
            )}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-green-400" /> 最近提交
        </div>
        <RecentSubmissions
          components={components}
          pollResults={pollResults}
          wordclouds={wordclouds}
          ratingResults={ratingResults}
          questions={questions}
        />
      </div>

      {components.length > 0 && (
        <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-400/20 text-center">
          <p className="text-xs text-primary-300 font-medium">
            {paused ? "已暂停 · 恢复后可翻页" : "互动进行中 · 确认数据稳定后可翻页"}
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentProgressBar({
  comp,
  audienceCount,
  pollResults,
  wordclouds,
  ratingResults,
  questions,
}: {
  comp: any;
  audienceCount: number;
  pollResults: Record<string, any>;
  wordclouds: Record<string, any[]>;
  ratingResults: Record<string, any>;
  questions: any[];
}) {
  const typeLabel: Record<string, string> = { poll: "投票", wordcloud: "词云", rating: "评分", qna: "问答" };
  let participated = 0;
  let total = audienceCount;

  if (comp.type === "poll" && pollResults[comp.id]) {
    participated = pollResults[comp.id].totalResponses;
  } else if (comp.type === "wordcloud" && wordclouds[comp.id]) {
    participated = wordclouds[comp.id].reduce((s: number, w: any) => s + w.count, 0);
  } else if (comp.type === "rating" && ratingResults[comp.id]) {
    participated = ratingResults[comp.id].totalResponses;
  } else if (comp.type === "qna") {
    const compQuestions = questions.filter((q: any) => q.componentId === comp.id);
    participated = compQuestions.length;
  }

  const pct = total > 0 ? Math.min(100, Math.round((participated / total) * 100)) : 0;
  const prompt = comp.config?.question || comp.config?.prompt || comp.config?.title || typeLabel[comp.type];

  return (
    <div className="p-2 rounded-lg bg-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-white/60 truncate max-w-[160px]">{prompt}</span>
        <span className="text-[10px] text-white/40">
          {participated}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct >= 70 ? "bg-green-400" : pct >= 40 ? "bg-yellow-400" : "bg-primary-400"
          }`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-white/30 mt-0.5">{pct}%</div>
    </div>
  );
}

function RecentSubmissions({
  components,
  pollResults,
  wordclouds,
  ratingResults,
  questions,
}: {
  components: any[];
  pollResults: Record<string, any>;
  wordclouds: Record<string, any[]>;
  ratingResults: Record<string, any>;
  questions: any[];
}) {
  const items: { time: string; text: string }[] = [];

  for (const comp of components) {
    if (comp.type === "poll" && pollResults[comp.id]) {
      items.push({
        time: "实时",
        text: `投票: ${pollResults[comp.id].totalResponses} 人已参与`,
      });
    }
    if (comp.type === "wordcloud" && wordclouds[comp.id]) {
      const words = wordclouds[comp.id];
      const latest = words.slice(-3);
      for (const w of latest) {
        items.push({ time: "新", text: `词云: "${w.word}"` });
      }
    }
    if (comp.type === "rating" && ratingResults[comp.id]) {
      items.push({
        time: "实时",
        text: `评分: 平均 ${ratingResults[comp.id].average} 分 (${ratingResults[comp.id].totalResponses} 人)`,
      });
    }
    if (comp.type === "qna") {
      const compQ = questions.filter((q: any) => q.componentId === comp.id);
      const recent = [...compQ].sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
      for (const q of recent) {
        items.push({
          time: new Date(q.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          text: `提问: "${q.content.slice(0, 40)}${q.content.length > 40 ? "..." : ""}"`,
        });
      }
    }
  }

  if (items.length === 0) {
    return <p className="text-xs text-white/30 text-center py-2">等待互动数据...</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.slice(0, 6).map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-[11px]">
          <span className="text-white/30 shrink-0">{item.time}</span>
          <span className="text-white/60">{item.text}</span>
        </div>
      ))}
    </div>
  );
}
