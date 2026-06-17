import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  Presentation,
  Session,
  PollResult,
  RatingResult,
  ReportData,
  Slide,
  InteractiveComponent,
  PollConfig,
  RatingConfig,
  WordcloudConfig,
  QnaConfig,
} from "../shared/types.js";

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
  const cfg = component.config as RatingConfig;
  const dist: { rating: number; count: number }[] = [];
  for (let v = cfg.min; v <= cfg.max; v += cfg.step) {
    dist.push({ rating: v, count: 0 });
  }
  let sum = 0;
  for (const r of responses) {
    sum += r.rating;
    const d = dist.find((x) => x.rating === r.rating);
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
      let results: PollResult | (typeof session.words)[string] | RatingResult | { questions: typeof session.questions } =
        [];
      if (c.type === "poll") results = calculatePollResult(session, c);
      else if (c.type === "wordcloud") results = session.words[c.id] || [];
      else if (c.type === "rating") results = calculateRatingResult(session, c);
      else results = { questions: session.questions };
      return { componentId: c.id, type: c.type, prompt, results };
    }),
  }));
  return { presentation, session, totalAudience, slidesReport };
}
