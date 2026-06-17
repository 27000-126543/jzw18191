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
      if (data.sessionId) {
        setTimeout(() => navigate(`/report/${id}/${data.sessionId}`), 800);
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
      socket.emit("presenter:end", { presentationId: id });
      navigate(`/report/${id}/${res.sessionId}`);
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
            {questions.filter((q) => !q.isAnswered).length > 0 && (
              <span className="absolute -mt-6 ml-3 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 font-bold">
                {questions.filter((q) => !q.isAnswered).length}
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
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="font-display text-base flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-accent-400" />
                问答管理
              </div>
              <span className="chip bg-white/10 text-white/80">
                共 {questions.length} 条
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-2.5">
              {questions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-white/40 py-10">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                  <p>暂无观众提问</p>
                  <p className="text-xs opacity-60 mt-1">
                    问答将实时显示在这里
                  </p>
                </div>
              ) : (
                [...questions]
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
