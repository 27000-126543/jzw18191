import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  Sparkles,
  Image,
  Type,
  Paintbrush,
  Layers,
  FileText,
} from "lucide-react";
import { api } from "../api/client";
import { useEditorStore } from "../store/useAppStore";
import type { Presentation, Slide, InteractiveComponent } from "../../shared/types";
import SlideCanvas from "../components/SlideCanvas";
import ComponentPicker from "../components/ComponentPicker";
import ComponentPropertyEditor from "../components/ComponentPropertyEditor";

const BG_PRESETS = [
  { name: "纯白", value: "#ffffff" },
  { name: "深蓝", value: "linear-gradient(135deg, #1E3A8A 0%, #6366F1 100%)" },
  { name: "青绿", value: "linear-gradient(135deg, #0F766E 0%, #2DD4BF 100%)" },
  { name: "橙调", value: "linear-gradient(135deg, #C2410C 0%, #FB923C 100%)" },
  { name: "紫粉", value: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)" },
  { name: "深黑", value: "linear-gradient(135deg, #0F172A 0%, #334155 100%)" },
];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"components" | "properties">("components");

  const presentation = useEditorStore((s) => s.presentation);
  const activeSlideId = useEditorStore((s) => s.activeSlideId);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const setPresentation = useEditorStore((s) => s.setPresentation);
  const setActiveSlide = useEditorStore((s) => s.setActiveSlide);
  const setSelectedComponent = useEditorStore((s) => s.setSelectedComponent);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const addSlide = useEditorStore((s) => s.addSlide);
  const deleteSlide = useEditorStore((s) => s.deleteSlide);
  const addComponent = useEditorStore((s) => s.addComponent);
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const deleteComponent = useEditorStore((s) => s.deleteComponent);

  const activeSlide = useMemo(() => {
    return presentation?.slides.find((s) => s.id === activeSlideId) ?? null;
  }, [presentation, activeSlideId]);

  const selectedComponent = useMemo(() => {
    return activeSlide?.components.find((c) => c.id === selectedComponentId) ?? null;
  }, [activeSlide, selectedComponentId]);

  useEffect(() => {
    if (!id) return;
    loadPresentation(id);
    return () => setPresentation(null);
  }, [id]);

  useEffect(() => {
    if (selectedComponent) setRightTab("properties");
  }, [selectedComponentId]);

  async function loadPresentation(pid: string) {
    setLoading(true);
    try {
      const p = await api.getPresentation(pid);
      setPresentation(p);
    } catch (e) {
      alert("加载失败：" + (e as Error).message);
      navigate("/");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!presentation) return;
    setSaving(true);
    try {
      await api.updatePresentation(presentation.id, {
        title: presentation.title,
        slides: presentation.slides,
      } as Partial<Presentation>);
      setSavedAt(new Date().toLocaleTimeString());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e) {
      alert("保存失败：" + (e as Error).message);
    }
    setSaving(false);
  }

  function handleUpdateTitle(title: string) {
    if (!presentation) return;
    useEditorStore.setState({ presentation: { ...presentation, title } });
  }

  function handleAddComponent(c: InteractiveComponent) {
    if (!activeSlide) return;
    addComponent(activeSlide.id, c);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mesh">
        <div className="text-slate-500 animate-pulse-soft">正在加载演示文稿...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-5 gap-4 shrink-0 z-20">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          title="返回首页"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={presentation?.title ?? ""}
            onChange={(e) => handleUpdateTitle(e.target.value)}
            className="bg-transparent font-display text-xl text-slate-800 w-full outline-none focus:bg-white rounded px-2 py-0.5 -mx-2"
          />
          <div className="text-xs text-slate-400 px-2 -mt-0.5">
            {presentation?.slides.length ?? 0} 页 · {savedAt ? `已保存于 ${savedAt}` : "未保存"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-outline text-sm py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中" : "保存"}
          </button>
          <button
            onClick={() => presentation && navigate(`/present/${presentation.id}`)}
            className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> 开始演示
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white/60 backdrop-blur-sm overflow-y-auto scrollbar-thin p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              幻灯片
            </div>
            <button
              onClick={() => addSlide()}
              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50"
              title="新增幻灯片"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {presentation?.slides.map((slide, i) => (
              <div
                key={slide.id}
                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
                  activeSlideId === slide.id
                    ? "border-primary-400 shadow-glow"
                    : "border-transparent hover:border-slate-200"
                }`}
                onClick={() => {
                  setActiveSlide(slide.id);
                  setSelectedComponent(null);
                }}
              >
                <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-white/90 text-xs font-bold text-slate-600 flex items-center justify-center shadow-sm">
                  {i + 1}
                </div>
                {(presentation?.slides.length ?? 0) > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除第 ${i + 1} 页？`)) deleteSlide(slide.id);
                    }}
                    className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-red-500/90 text-white items-center justify-center opacity-0 group-hover:flex hover:bg-red-600 transition"
                    style={{ display: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.display = "flex")}
                    onMouseLeave={(e) => (e.currentTarget.style.display = "none")}
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <div
                  className="aspect-video"
                  style={{ background: slide.background || "#fff" }}
                >
                  <div className="p-2 h-full overflow-hidden">
                    <div
                      className={`font-bold text-[10px] leading-tight mb-1 ${
                        hasDark(slide.background) ? "text-white" : "text-slate-800"
                      }`}
                    >
                      {slide.title || "（无标题）"}
                    </div>
                    {slide.components.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap mt-1">
                        {slide.components.map((c, idx) => (
                          <span
                            key={c.id}
                            className={`w-2 h-2 rounded-full ${
                              ["bg-primary-400", "bg-accent-400", "bg-highlight-400", "bg-purple-400"][
                                idx % 4
                              ]
                            }`}
                            title={c.type}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => addSlide()}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50/40 text-slate-400 hover:text-primary-500 flex flex-col items-center justify-center gap-1 transition"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-medium">新增页面</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-slate-100/60 p-6 overflow-hidden">
          {activeSlide && (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full max-w-5xl aspect-video">
                <SlideCanvas
                  slide={activeSlide}
                  selectedComponentId={selectedComponentId}
                  onComponentClick={(cid) =>
                    setSelectedComponent(selectedComponentId === cid ? null : cid)
                  }
                />
              </div>
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white/70 backdrop-blur-sm flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-100 shrink-0">
            {[
              { id: "components", label: "组件", icon: Layers },
              { id: "properties", label: "属性", icon: Paintbrush },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id as any)}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
                  rightTab === t.id
                    ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {rightTab === "components" && (
              <div className="space-y-5">
                <ComponentPicker onAdd={handleAddComponent} />
                {activeSlide && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      当前幻灯片
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Type className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 flex-1">标题</span>
                    </label>
                    <input
                      value={activeSlide.title}
                      onChange={(e) => updateSlide(activeSlide.id, { title: e.target.value })}
                      className="input-field text-sm py-1.5"
                    />
                    <label className="flex items-center gap-2 text-sm mt-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 flex-1">内容</span>
                    </label>
                    <textarea
                      value={activeSlide.content}
                      onChange={(e) => updateSlide(activeSlide.id, { content: e.target.value })}
                      rows={4}
                      className="input-field text-sm py-1.5 resize-none"
                    />
                    <div className="mt-3">
                      <label className="flex items-center gap-2 text-sm mb-2">
                        <Image className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">背景</span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BG_PRESETS.map((bg) => (
                          <button
                            key={bg.name}
                            onClick={() => updateSlide(activeSlide.id, { background: bg.value })}
                            className={`h-10 rounded-lg border-2 transition-all ${
                              activeSlide.background === bg.value
                                ? "border-primary-400 scale-105 shadow-md"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                            style={{ background: bg.value }}
                            title={bg.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {rightTab === "properties" && (
              <div>
                {selectedComponent && activeSlide ? (
                  <ComponentPropertyEditor
                    slideId={activeSlide.id}
                    component={selectedComponent}
                    onChange={(patch) =>
                      updateComponent(activeSlide.id, selectedComponent.id, patch)
                    }
                    onDelete={() => deleteComponent(activeSlide.id, selectedComponent.id)}
                    onClose={() => setSelectedComponent(null)}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-sm text-slate-400 py-10">
                    <Layers className="w-12 h-12 mb-3 opacity-50" />
                    <p>在画布上点击任意互动组件</p>
                    <p>以编辑其属性</p>
                    <button
                      onClick={() => setRightTab("components")}
                      className="mt-4 text-primary-500 hover:text-primary-600 font-medium"
                    >
                      → 先去添加组件
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function hasDark(bg?: string): boolean {
  if (!bg) return false;
  return /#1E3A8A|#6366F1|#0F766E|#2DD4BF|#C2410C|#7C3AED|#0F172A|gradient/i.test(bg);
}
