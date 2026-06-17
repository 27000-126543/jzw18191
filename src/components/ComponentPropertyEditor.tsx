import { X, Plus, Trash2 } from "lucide-react";
import type { InteractiveComponent } from "../../shared/types";
import type { PollConfig, WordcloudConfig, RatingConfig, QnaConfig } from "../../shared/types";

interface Props {
  slideId: string;
  component: InteractiveComponent;
  onChange: (patch: Partial<InteractiveComponent>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ComponentPropertyEditor({
  slideId,
  component,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const typeNames: Record<string, string> = {
    poll: "选择题投票",
    wordcloud: "关键词云",
    rating: "评分滑块",
    qna: "问答收集",
  };
  void slideId;

  function updateConfig(patch: Record<string, any>) {
    onChange({
      config: { ...(component.config as any), ...patch } as any,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg text-slate-800">
          {typeNames[component.type]}属性
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {component.type === "poll" && (
        <PollEditor config={component.config as PollConfig} update={updateConfig} />
      )}
      {component.type === "wordcloud" && (
        <WordcloudEditor config={component.config as WordcloudConfig} update={updateConfig} />
      )}
      {component.type === "rating" && (
        <RatingEditor config={component.config as RatingConfig} update={updateConfig} />
      )}
      {component.type === "qna" && (
        <QnaEditor config={component.config as QnaConfig} update={updateConfig} />
      )}

      <Section title="位置与大小（%）">
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs text-slate-500 capitalize">{k}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={component.position?.[k] ?? 0}
                onChange={(e) =>
                  onChange({
                    position: {
                      x: component.position?.x ?? 0,
                      y: component.position?.y ?? 0,
                      width: component.position?.width ?? 100,
                      height: component.position?.height ?? 100,
                      [k]: Number(e.target.value),
                    },
                  })
                }
                className="input-field py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </Section>

      <button
        onClick={() => {
          if (confirm("确认删除此组件吗？")) onDelete();
        }}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition"
      >
        <Trash2 className="w-4 h-4" /> 删除此组件
      </button>
    </div>
  );
}

function PollEditor({
  config,
  update,
}: {
  config: PollConfig;
  update: (p: Record<string, any>) => void;
}) {
  function updateOption(idx: number, value: string) {
    const options = [...config.options];
    options[idx] = value;
    update({ options });
  }
  function addOption() {
    update({ options: [...config.options, `选项 ${config.options.length + 1}`] });
  }
  function removeOption(idx: number) {
    if (config.options.length <= 2) return;
    update({ options: config.options.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3.5">
      <Section title="问题">
        <textarea
          value={config.question}
          onChange={(e) => update({ question: e.target.value })}
          rows={2}
          className="input-field text-sm resize-none"
        />
      </Section>
      <Section title={`选项（${config.options.length}）`}>
        <div className="space-y-1.5">
          {config.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 w-5 text-center">
                {i + 1}
              </span>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                className="input-field py-1.5 text-sm flex-1"
              />
              <button
                onClick={() => removeOption(i)}
                disabled={config.options.length <= 2}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addOption}
          className="mt-1.5 w-full py-1.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-primary-300 hover:bg-primary-50/30 text-sm text-slate-500 hover:text-primary-600 flex items-center justify-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" /> 添加选项
        </button>
      </Section>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={config.multiSelect}
          onChange={(e) => update({ multiSelect: e.target.checked })}
          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
        />
        允许多选
      </label>
    </div>
  );
}

function WordcloudEditor({
  config,
  update,
}: {
  config: WordcloudConfig;
  update: (p: Record<string, any>) => void;
}) {
  return (
    <div className="space-y-3.5">
      <Section title="提示词">
        <textarea
          value={config.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={2}
          className="input-field text-sm resize-none"
        />
      </Section>
      <Section title="最大词汇数">
        <input
          type="number"
          min={10}
          max={200}
          value={config.maxWords ?? 50}
          onChange={(e) => update({ maxWords: Number(e.target.value) })}
          className="input-field py-1.5 text-sm"
        />
      </Section>
    </div>
  );
}

function RatingEditor({
  config,
  update,
}: {
  config: RatingConfig;
  update: (p: Record<string, any>) => void;
}) {
  return (
    <div className="space-y-3.5">
      <Section title="标题">
        <textarea
          value={config.title}
          onChange={(e) => update({ title: e.target.value })}
          rows={2}
          className="input-field text-sm resize-none"
        />
      </Section>
      <div className="grid grid-cols-2 gap-3">
        <Section title="最小值">
          <input
            type="number"
            value={config.min}
            onChange={(e) => update({ min: Number(e.target.value) })}
            className="input-field py-1.5 text-sm"
          />
        </Section>
        <Section title="最大值">
          <input
            type="number"
            value={config.max}
            onChange={(e) => update({ max: Number(e.target.value) })}
            className="input-field py-1.5 text-sm"
          />
        </Section>
      </div>
      <Section title="步长">
        <input
          type="number"
          min={0.1}
          value={config.step}
          onChange={(e) => update({ step: Number(e.target.value) })}
          className="input-field py-1.5 text-sm"
        />
      </Section>
      <div className="grid grid-cols-2 gap-3">
        <Section title="最低标签">
          <input
            value={config.minLabel}
            onChange={(e) => update({ minLabel: e.target.value })}
            placeholder="如：很差"
            className="input-field py-1.5 text-sm"
          />
        </Section>
        <Section title="最高标签">
          <input
            value={config.maxLabel}
            onChange={(e) => update({ maxLabel: e.target.value })}
            placeholder="如：很棒"
            className="input-field py-1.5 text-sm"
          />
        </Section>
      </div>
    </div>
  );
}

function QnaEditor({
  config,
  update,
}: {
  config: QnaConfig;
  update: (p: Record<string, any>) => void;
}) {
  return (
    <div className="space-y-3.5">
      <Section title="提示词">
        <textarea
          value={config.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={2}
          className="input-field text-sm resize-none"
        />
      </Section>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={config.anonymous}
          onChange={(e) => update({ anonymous: e.target.checked })}
          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
        />
        允许匿名提问
      </label>
    </div>
  );
}
