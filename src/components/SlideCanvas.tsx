import type { Slide, InteractiveComponent, WordcloudUpdateData } from "../../shared/types";
import type { PollResult, RatingResult, AudienceQuestion } from "../../shared/types";
import PollDisplay from "./interactive/PollDisplay";
import WordcloudDisplay from "./interactive/WordcloudDisplay";
import RatingDisplay from "./interactive/RatingDisplay";
import QnaDisplay from "./interactive/QnaDisplay";

interface Props {
  slide: Slide;
  dark?: boolean;
  liveData?: {
    pollResults: Record<string, PollResult>;
    wordclouds: Record<string, WordcloudUpdateData>;
    ratingResults: Record<string, RatingResult>;
    questions: AudienceQuestion[];
    shownQuestion: AudienceQuestion | null;
  };
  selectedComponentId?: string | null;
  onComponentClick?: (id: string) => void;
  showComponents?: boolean;
  scale?: number;
}

function hasDarkBackground(style?: string): boolean {
  if (!style) return false;
  const s = style.toLowerCase();
  return (
    s.includes("#1e3a8a") ||
    s.includes("#6366f1") ||
    s.includes("gradient") ||
    s.includes("dark") ||
    s.includes("rgb(30") ||
    s.includes("rgba(30")
  );
}

function renderComponent(
  comp: InteractiveComponent,
  dark: boolean,
  liveData?: Props["liveData"],
) {
  switch (comp.type) {
    case "poll":
      return (
        <PollDisplay
          config={comp.config as any}
          result={liveData?.pollResults[comp.id]}
          dark={dark}
        />
      );
    case "wordcloud":
      return (
        <WordcloudDisplay
          config={comp.config as any}
          words={liveData?.wordclouds[comp.id]?.words}
          dark={dark}
        />
      );
    case "rating":
      return (
        <RatingDisplay
          config={comp.config as any}
          result={liveData?.ratingResults[comp.id]}
          dark={dark}
        />
      );
    case "qna":
      return (
        <QnaDisplay
          config={comp.config as any}
          questions={liveData?.questions?.filter((q: any) => q.componentId === comp.id)}
          shownQuestion={liveData?.shownQuestion?.componentId === comp.id ? liveData.shownQuestion : null}
          dark={dark}
        />
      );
  }
}

export default function SlideCanvas({
  slide,
  dark = false,
  liveData,
  selectedComponentId,
  onComponentClick,
  showComponents = true,
  scale = 1,
}: Props) {
  const bg = slide.background;
  const slideDark = dark || hasDarkBackground(bg);
  const titleColor = slideDark ? "text-white" : "text-slate-900";
  const contentColor = slideDark ? "text-white/90" : "text-slate-600";

  return (
    <div
      className="w-full h-full relative rounded-xl overflow-hidden shadow-2xl"
      style={{
        background: bg || (dark ? "linear-gradient(135deg,#0f172a,#1e293b)" : "#ffffff"),
      }}
    >
      <div className="absolute inset-0 flex flex-col p-8 md:p-12">
        <h2
          className={`font-display text-3xl md:text-5xl leading-tight mb-4 animate-fade-in ${titleColor}`}
        >
          {slide.title}
        </h2>
        {slide.content && (
          <p
            className={`text-base md:text-xl whitespace-pre-line leading-relaxed mb-4 animate-fade-in ${contentColor}`}
          >
            {slide.content}
          </p>
        )}
        {showComponents && slide.components.length > 0 && (
          <div className="flex-1 relative min-h-0 mt-2">
            {slide.components.map((comp) => {
              const pos = comp.position || { x: 0, y: 0, width: 100, height: 100 };
              const isSelected = selectedComponentId === comp.id;
              return (
                <div
                  key={comp.id}
                  onClick={() => onComponentClick?.(comp.id)}
                  className={`absolute rounded-2xl overflow-hidden transition-all animate-slide-up ${
                    slideDark
                      ? "bg-white/8 backdrop-blur-sm border border-white/15"
                      : "bg-white/80 backdrop-blur-md border border-slate-200 shadow-lg"
                  } ${
                    isSelected
                      ? "ring-4 ring-primary-400/70 shadow-glow cursor-pointer"
                      : onComponentClick
                      ? "cursor-pointer hover:ring-2 hover:ring-primary-300/60"
                      : ""
                  }`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${pos.width}%`,
                    height: `${pos.height}%`,
                    transform: `scale(${scale})`,
                  }}
                >
                  {renderComponent(comp, slideDark, liveData)}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {slideDark && (
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
          style={{
            background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 50%)",
          }}
        />
      )}
    </div>
  );
}
