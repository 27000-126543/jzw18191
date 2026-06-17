import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Calendar,
  Trash2,
  Edit3,
  Play,
  Sparkles,
  Users,
  BarChart3,
} from "lucide-react";
import { api } from "../api/client";
import type { PresentationListItem } from "../api/client";
import { useLiveStore } from "../store/useAppStore";

export default function Home() {
  const navigate = useNavigate();
  const [list, setList] = useState<PresentationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const setLive = useLiveStore((s) => s.setLive);

  useEffect(() => {
    loadList();
    setLive({
      roomCode: null,
      sessionId: null,
      currentSlideIndex: 0,
      paused: false,
      pollResults: {},
      wordclouds: {},
      ratingResults: {},
      questions: [],
      shownQuestion: null,
    });
  }, []);

  async function loadList() {
    setLoading(true);
    try {
      const data = await api.listPresentations();
      setList(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const p = await api.createPresentation(newTitle.trim());
      navigate(`/editor/${p.id}`);
    } catch (e) {
      alert("创建失败，请重试");
    }
    setCreating(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`确认删除 "${title}" 吗？`)) return;
    await api.deletePresentation(id);
    loadList();
  }

  function formatDate(d: string) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(
      dt.getMinutes(),
    ).padStart(2, "0")}`;
  }

  return (
    <div className="min-h-screen bg-mesh">
      <header className="border-b border-white/60 bg-white/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-primary-800 leading-tight">
                InteractDeck
              </h1>
              <p className="text-xs text-slate-500 -mt-0.5">
                实时互动演示文稿平台
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-accent-500" /> 观众实时互动
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-highlight-500" /> 数据报告导出
            </span>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl px-6 py-10">
        <section className="mb-10 animate-fade-in">
          <div className="card p-8 md:p-10 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-gradient-to-br from-primary-200/50 to-accent-200/40 blur-3xl pointer-events-none" />
            <div className="relative">
              <h2 className="font-display text-3xl md:text-4xl text-slate-900 mb-3">
                让您的演示 <span className="gradient-text">鲜活起来</span>
              </h2>
              <p className="text-slate-600 max-w-xl mb-6 leading-relaxed">
                创建演示文稿，插入投票、词云、问答和评分组件。观众扫码即可参与互动，
                结果实时汇聚到大屏，让每一次演讲都令人难忘。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="为您的演示文稿起个名字..."
                  className="input-field sm:flex-1 sm:max-w-md"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {creating ? "创建中..." : "新建演示文稿"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-xl text-slate-800">我的演示文稿</h3>
            <span className="text-sm text-slate-500">共 {list.length} 个</span>
          </div>
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6 animate-pulse-soft">
                  <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-slate-100 rounded w-1/2 mb-5" />
                  <div className="flex gap-2">
                    <div className="h-8 bg-slate-100 rounded flex-1" />
                    <div className="h-8 bg-slate-100 rounded flex-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="card py-16 text-center">
              <FileText className="w-14 h-14 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-1">还没有演示文稿</p>
              <p className="text-sm text-slate-400">
                在上方输入标题，开始创建您的第一份互动演示吧
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.map((p, idx) => (
                <div
                  key={p.id}
                  className="card p-6 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-slide-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center shadow-md">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <button
                      onClick={() => handleDelete(p.id, p.title)}
                      className="opacity-0 group-hover:opacity-100 transition p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-lg text-slate-800 mb-1 truncate">
                    {p.title}
                  </h4>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-5">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {p.slideCount} 页
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(p.updatedAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate(`/editor/${p.id}`)}
                      className="btn-outline text-sm py-2 px-3 flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-4 h-4" /> 编辑
                    </button>
                    <button
                      onClick={() => navigate(`/present/${p.id}`)}
                      className="btn-secondary text-sm py-2 px-3 flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-4 h-4" /> 演示
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="container max-w-6xl px-6 py-8 text-center text-xs text-slate-400">
        <p>© InteractDeck · 让每一次演讲都充满互动的力量</p>
      </footer>
    </div>
  );
}
