import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  Presentation,
  Session,
  PollResult,
  RatingResult,
  ReportData,
  ComponentReportSummary,
  ReportInsight,
  Slide,
  InteractiveComponent,
  PollConfig,
  RatingConfig,
  WordcloudConfig,
  QnaConfig,
  AudienceQuestion,
  WordEntry,
  AggregatedWord,
} from "../shared/types.js";
import { sanitizeRatingConfig } from "../shared/types.js";

function aggregateWordcloud(entries: WordEntry[]): AggregatedWord[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.word, (map.get(e.word) ?? 0) + e.count);
  }
  return Array.from(map, ([word, count]) => ({ word, count }));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const PRESENTATIONS_FILE = path.join(DATA_DIR, "presentations.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8");
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(file: string, data: T): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export const presentations: Map<string, Presentation> = new Map(
  Object.entries(readJson<Record<string, Presentation>>(PRESENTATIONS_FILE, {})),
);
export const sessions: Map<string, Session> = new Map(
  Object.entries(readJson<Record<string, Session>>(SESSIONS_FILE, {})),
);
export const sessionsByRoom: Map<string, string> = new Map();
for (const s of sessions.values()) {
  sessionsByRoom.set(s.roomCode, s.id);
}

export function persistPresentations(): void {
  writeJson(PRESENTATIONS_FILE, Object.fromEntries(presentations));
}
export function persistSessions(): void {
  writeJson(SESSIONS_FILE, Object.fromEntries(sessions));
}

export function genId(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function genRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (sessionsByRoom.has(code)) return genRoomCode();
  return code;
}

export function createPresentation(title: string): Presentation {
  const now = new Date().toISOString();
  const sampleSlides: Slide[] = [
    {
      id: genId("sl_"),
      index: 0,
      title: "欢迎",
      content: "欢迎参与本次互动演示\n\n请使用手机扫描右下角的二维码加入互动",
      background: "linear-gradient(135deg, #1E3A8A 0%, #6366F1 100%)",
      components: [],
    },
    {
      id: genId("sl_"),
      index: 1,
      title: "快速投票",
      content: "您对本次演示的整体期望如何？",
      components: [
        {
          id: genId("cmp_"),
          type: "poll",
          config: {
            question: "您对本次演示的整体期望如何？",
            options: ["非常高", "较高", "一般", "较低"],
            multiSelect: false,
          } as PollConfig,
          position: { x: 5, y: 35, width: 90, height: 60 },
        },
      ],
    },
    {
      id: genId("sl_"),
      index: 2,
      title: "关键词云",
      content: "用一个词描述您现在的心情：",
      components: [
        {
          id: genId("cmp_"),
          type: "wordcloud",
          config: { prompt: "用一个词描述您现在的心情：", maxWords: 50 } as WordcloudConfig,
          position: { x: 5, y: 35, width: 90, height: 60 },
        },
      ],
    },
    {
      id: genId("sl_"),
      index: 3,
      title: "评分收集",
      content: "请为演示的技术准备打分：",
      components: [
        {
          id: genId("cmp_"),
          type: "rating",
          config: {
            title: "请为演示的技术准备打分",
            minLabel: "待改进",
            maxLabel: "非常专业",
            min: 1,
            max: 5,
            step: 1,
          } as RatingConfig,
          position: { x: 5, y: 35, width: 90, height: 55 },
        },
      ],
    },
    {
      id: genId("sl_"),
      index: 4,
      title: "问答环节",
      content: "有任何问题？请随时提问，您的问题将匿名提交。",
      components: [
        {
          id: genId("cmp_"),
          type: "qna",
          config: { prompt: "有什么想问的？", anonymous: true } as QnaConfig,
          position: { x: 5, y: 35, width: 90, height: 55 },
        },
      ],
    },
  ];
  const p: Presentation = {
    id: genId("pre_"),
    title,
    slides: sampleSlides,
    createdAt: now,
    updatedAt: now,
  };
  presentations.set(p.id, p);
  persistPresentations();
  return p;
}

export function savePresentation(p: Presentation): void {
  p.updatedAt = new Date().toISOString();
  presentations.set(p.id, p);
  persistPresentations();
}

export function deletePresentation(id: string): boolean {
  const ok = presentations.delete(id);
  if (ok) persistPresentations();
  return ok;
}

export function createSession(presentationId: string): Session | null {
  const presentation = presentations.get(presentationId);
  if (!presentation) return null;
  const existing = Array.from(sessions.values()).find(
    (s) => s.presentationId === presentationId && !s.endedAt,
  );
  if (existing) return existing;
  const roomCode = genRoomCode();
  const session: Session = {
    id: genId("sess_"),
    presentationId,
    roomCode,
    startedAt: new Date().toISOString(),
    currentSlide: 0,
    paused: false,
    pollResponses: [],
    words: {},
    ratingResponses: [],
    questions: [],
    audienceIds: [],
  };
  for (const slide of presentation.slides) {
    for (const comp of slide.components) {
      if (comp.type === "wordcloud" && !session.words[comp.id]) {
        session.words[comp.id] = [];
      }
    }
  }
  sessions.set(session.id, session);
  sessionsByRoom.set(roomCode, session.id);
  persistSessions();
  return session;
}

export function endSession(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  s.endedAt = new Date().toISOString();
  persistSessions();
  return true;
}

export function calculatePollResult(
  session: Session,
  component: InteractiveComponent,
): PollResult {
  const responses = session.pollResponses.filter((r) => r.componentId === component.id);
  const cfg = component.config as PollConfig;
  const optionCounts = cfg.options.map(() => 0);
  for (const r of responses) {
    for (const idx of r.optionIndices) {
      if (optionCounts[idx] !== undefined) optionCounts[idx]++;
    }
  }
  const uniqueAudience = new Set(responses.map((r) => r.audienceId)).size;
  const optionPercentages = optionCounts.map(
    (c) => (uniqueAudience === 0 ? 0 : Math.round((c / uniqueAudience) * 100)),
  );
  return {
    componentId: component.id,
    totalResponses: uniqueAudience,
    optionCounts,
    optionPercentages,
    multiSelect: cfg.multiSelect,
  };
}

export function calculateRatingResult(
  session: Session,
  component: InteractiveComponent,
): RatingResult {
  const responses = session.ratingResponses.filter((r) => r.componentId === component.id);
  const rawCfg = component.config as RatingConfig;
  const cfg = sanitizeRatingConfig(rawCfg);
  const dist: { rating: number; count: number }[] = [];
  for (let v = cfg.min; v <= cfg.max + cfg.step * 0.001; v = +(v + cfg.step).toFixed(4)) {
    dist.push({ rating: +v.toFixed(2), count: 0 });
    if (dist.length > 100) break;
  }
  let sum = 0;
  for (const r of responses) {
    sum += r.rating;
    const d = dist.find((x) => Math.abs(x.rating - r.rating) < cfg.step * 0.5);
    if (d) d.count++;
  }
  const total = responses.length;
  let minRating = cfg.max;
  let maxRating = cfg.min;
  for (const r of responses) {
    if (r.rating < minRating) minRating = r.rating;
    if (r.rating > maxRating) maxRating = r.rating;
  }
  return {
    componentId: component.id,
    totalResponses: total,
    average: total === 0 ? 0 : +(sum / total).toFixed(2),
    min: total === 0 ? 0 : minRating,
    max: total === 0 ? 0 : maxRating,
    distribution: dist,
  };
}

export function buildReport(presentationId: string, sessionId: string): ReportData | null {
  const presentation = presentations.get(presentationId);
  const session = sessions.get(sessionId);
  if (!presentation || !session) return null;
  const totalAudience = session.audienceIds.length;
  const slidesReport = presentation.slides.map((slide) => ({
    slideIndex: slide.index,
    slideTitle: slide.title,
    components: slide.components.map((c) => {
      const cfg = c.config as PollConfig | WordcloudConfig | RatingConfig | QnaConfig;
      let prompt = "";
      if (c.type === "poll") prompt = (cfg as PollConfig).question;
      else if (c.type === "wordcloud") prompt = (cfg as WordcloudConfig).prompt;
      else if (c.type === "rating") prompt = (cfg as RatingConfig).title;
      else prompt = (cfg as QnaConfig).prompt;
      let results: PollResult | WordEntry[] | AggregatedWord[] | RatingResult | { questions: AudienceQuestion[] } =
        [];
      if (c.type === "poll") results = calculatePollResult(session, c);
      else if (c.type === "wordcloud") results = aggregateWordcloud(session.words[c.id] || []);
      else if (c.type === "rating") results = calculateRatingResult(session, c);
      else results = { questions: session.questions.filter((q) => q.componentId === c.id) };
      const summary = buildComponentSummary(session, c, results, totalAudience);
      return { componentId: c.id, type: c.type, prompt, results, summary };
    }),
  }));
  return { presentation, session, totalAudience, insights: analyzeInsights(session, presentation, slidesReport), slidesReport };
}

function buildComponentSummary(
  session: Session,
  component: InteractiveComponent,
  results: PollResult | WordEntry[] | AggregatedWord[] | RatingResult | { questions: AudienceQuestion[] },
  totalAudience: number,
): ComponentReportSummary {
  let totalSubmissions = 0;
  let uniqueParticipants = 0;
  const timestamps: string[] = [];

  if (component.type === "poll") {
    const r = results as PollResult;
    totalSubmissions = r.optionCounts.reduce((s, c) => s + c, 0);
    uniqueParticipants = r.totalResponses;
    session.pollResponses
      .filter((x) => x.componentId === component.id)
      .forEach((x) => { if (x.timestamp) timestamps.push(x.timestamp); });
  } else if (component.type === "wordcloud") {
    const raw = session.words[component.id] ?? [];
    totalSubmissions = raw.length;
    const uniqueAudiences = new Set<string>();
    for (const e of raw) {
      if (e.audienceId) uniqueAudiences.add(e.audienceId);
      if (e.timestamp) timestamps.push(e.timestamp);
    }
    uniqueParticipants = uniqueAudiences.size;
  } else if (component.type === "rating") {
    const r = results as RatingResult;
    totalSubmissions = r.totalResponses;
    uniqueParticipants = r.totalResponses;
    session.ratingResponses
      .filter((x) => x.componentId === component.id)
      .forEach((x) => { if (x.timestamp) timestamps.push(x.timestamp); });
  } else {
    const q = (results as { questions: AudienceQuestion[] }).questions;
    totalSubmissions = q.length;
    uniqueParticipants = Math.min(q.length, totalAudience);
    q.forEach((x) => { if (x.createdAt) timestamps.push(x.createdAt); });
  }

  timestamps.sort();
  const completionRate = totalAudience > 0 ? Math.round((uniqueParticipants / totalAudience) * 100) : 0;
  return {
    componentId: component.id,
    type: component.type,
    prompt: (component.config as any).question || (component.config as any).prompt || (component.config as any).title || "",
    totalSubmissions,
    uniqueParticipants,
    completionRate,
    firstSubmissionAt: timestamps[0] || null,
    lastSubmissionAt: timestamps[timestamps.length - 1] || null,
  };
}

function analyzeInsights(
  session: Session,
  presentation: Presentation,
  slidesReport: ReportData["slidesReport"],
): ReportInsight[] {
  const insights: ReportInsight[] = [];

  for (const slideReport of slidesReport) {
    for (const comp of slideReport.components) {
      const s = comp.summary;
      const slide = presentation.slides[slideReport.slideIndex];
      const component = slide?.components.find((c) => c.id === comp.componentId);
      if (!component) continue;

      if (s.uniqueParticipants > 0 && s.completionRate < 40) {
        insights.push({
          type: "low_participation",
          severity: "warning",
          componentId: comp.componentId,
          slideIndex: slideReport.slideIndex,
          slideTitle: slideReport.slideTitle,
          prompt: s.prompt,
          title: "参与率偏低",
          description: `完成率仅 ${s.completionRate}%，低于 40% 的建议阈值。可能是互动引导不足或页面停留时间太短。`,
          metric: `完成率 ${s.completionRate}%（${s.uniqueParticipants}/${session.audienceIds.length} 人参与）`,
        });
      }

      if (comp.type === "poll" && s.uniqueParticipants >= 3) {
        const r = comp.results as PollResult;
        const sortedPct = [...r.optionPercentages].sort((a, b) => b - a);
        const topPct = sortedPct[0] ?? 0;
        const gap = (sortedPct[0] ?? 0) - (sortedPct[1] ?? 0);
        if (topPct < 40) {
          insights.push({
            type: "high_divergence",
            severity: "info",
            componentId: comp.componentId,
            slideIndex: slideReport.slideIndex,
            slideTitle: slideReport.slideTitle,
            prompt: s.prompt,
            title: "观点高度分歧",
            description: `最高票选项仅 ${topPct}%，没有形成共识，适合作为讨论切入点。`,
            metric: `最高票 ${topPct}%，选项分布离散`,
          });
        } else if (topPct >= 70 && gap >= 50) {
          insights.push({
            type: "high_consensus",
            severity: "success",
            componentId: comp.componentId,
            slideIndex: slideReport.slideIndex,
            slideTitle: slideReport.slideTitle,
            prompt: s.prompt,
            title: "达成高度共识",
            description: `领先选项 ${topPct}%，领先第二名 ${gap} 个百分点，观众意见高度一致。`,
            metric: `共识度 ${topPct}%，优势 ${gap}%`,
          });
        }
      }

      if (comp.type === "rating" && s.uniqueParticipants >= 3) {
        const r = comp.results as RatingResult;
        const sumSq = r.distribution.reduce((acc, d) => acc + d.count * Math.pow(d.rating - r.average, 2), 0);
        const stdDev = Math.sqrt(sumSq / Math.max(1, r.totalResponses));
        const cfg = component.config as RatingConfig;
        const range = cfg.max - cfg.min;
        const volatility = range > 0 ? stdDev / range : 0;
        if (volatility > 0.3) {
          insights.push({
            type: "high_volatility",
            severity: "warning",
            componentId: comp.componentId,
            slideIndex: slideReport.slideIndex,
            slideTitle: slideReport.slideTitle,
            prompt: s.prompt,
            title: "评分波动明显",
            description: `评分标准差较大（${stdDev.toFixed(2)}），观众评价存在明显分化，值得关注两极意见。`,
            metric: `标准差 ${stdDev.toFixed(2)}，平均分 ${r.average}`,
          });
        }
      }

      if (comp.type === "qna") {
        const q = comp.results as { questions: AudienceQuestion[] };
        const unanswered = q.questions.filter((x) => !x.isAnswered).length;
        const answerRate = q.questions.length > 0 ? 100 - Math.round((unanswered / q.questions.length) * 100) : 100;
        if (q.questions.length >= 3 && answerRate < 50) {
          insights.push({
            type: "qa_backlog",
            severity: "danger",
            componentId: comp.componentId,
            slideIndex: slideReport.slideIndex,
            slideTitle: slideReport.slideTitle,
            prompt: s.prompt,
            title: "问答堆积严重",
            description: `共 ${q.questions.length} 个问题，仅回答 ${answerRate}%，建议会后跟进未回答问题。`,
            metric: `未回答 ${unanswered} 条，回答率 ${answerRate}%`,
          });
        }
      }
    }
  }

  return insights.sort((a, b) => {
    const sevOrder: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}
