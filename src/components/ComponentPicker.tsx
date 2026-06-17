import { Vote, Cloud, MessageCircleQuestion, SlidersHorizontal, Plus } from "lucide-react";
import type { InteractiveType, InteractiveComponent } from "../../shared/types";
import type { PollConfig, WordcloudConfig, RatingConfig, QnaConfig } from "../../shared/types";

const COMPONENTS: {
  type: InteractiveType;
  icon: any;
  name: string;
  desc: string;
  color: string;
  make: () => InteractiveComponent;
}[] = [
  {
    type: "poll",
    icon: Vote,
    name: "选择题投票",
    desc: "单选/多选投票并展示统计分布",
    color: "from-primary-500 to-primary-600",
    make: () => ({
      id: "cmp_" + Math.random().toString(36).slice(2, 10),
      type: "poll",
      config: {
        question: "请输入您的投票问题...",
        options: ["选项 A", "选项 B", "选项 C", "选项 D"],
        multiSelect: false,
      } as PollConfig,
      position: { x: 5, y: 35, width: 90, height: 55 },
    }),
  },
  {
    type: "wordcloud",
    icon: Cloud,
    name: "关键词云",
    desc: "观众提交关键词，实时生成词云",
    color: "from-accent-500 to-accent-600",
    make: () => ({
      id: "cmp_" + Math.random().toString(36).slice(2, 10),
      type: "wordcloud",
      config: { prompt: "请用一个词描述...", maxWords: 50 } as WordcloudConfig,
      position: { x: 5, y: 35, width: 90, height: 55 },
    }),
  },
  {
    type: "rating",
    icon: SlidersHorizontal,
    name: "评分滑块",
    desc: "收集观众评分并展示平均分",
    color: "from-highlight-400 to-highlight-600",
    make: () => ({
      id: "cmp_" + Math.random().toString(36).slice(2, 10),
      type: "rating",
      config: {
        title: "请为以下内容评分",
        minLabel: "很差",
        maxLabel: "很棒",
        min: 1,
        max: 5,
        step: 1,
      } as RatingConfig,
      position: { x: 5, y: 35, width: 90, height: 55 },
    }),
  },
  {
    type: "qna",
    icon: MessageCircleQuestion,
    name: "问答收集",
    desc: "匿名提问、选择性展示、标记已答",
    color: "from-purple-500 to-pink-500",
    make: () => ({
      id: "cmp_" + Math.random().toString(36).slice(2, 10),
      type: "qna",
      config: { prompt: "有什么想问的？", anonymous: true } as QnaConfig,
      position: { x: 5, y: 35, width: 90, height: 55 },
    }),
  },
];

interface Props {
  onAdd: (c: InteractiveComponent) => void;
}

export default function ComponentPicker({ onAdd }: Props) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        插入互动组件
      </div>
      <div className="grid gap-2.5">
        {COMPONENTS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.type}
              onClick={() => onAdd(c.make())}
              className="group p-3.5 rounded-xl bg-white border-2 border-slate-100 hover:border-primary-200 hover:bg-primary-50/40 transition-all text-left hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-800 text-sm">{c.name}</div>
                    <Plus className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-snug">{c.desc}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
