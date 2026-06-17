export type InteractiveType = "poll" | "wordcloud" | "qna" | "rating";

export interface PollConfig {
  question: string;
  options: string[];
  multiSelect: boolean;
}

export interface WordcloudConfig {
  prompt: string;
  maxWords?: number;
}

export interface RatingConfig {
  title: string;
  minLabel?: string;
  maxLabel?: string;
  min: number;
  max: number;
  step: number;
}

export function sanitizeRatingConfig(cfg: RatingConfig): RatingConfig {
  let { min, max, step } = cfg;
  if (typeof min !== "number" || isNaN(min) || !isFinite(min)) min = 1;
  if (typeof max !== "number" || isNaN(max) || !isFinite(max)) max = 5;
  if (typeof step !== "number" || isNaN(step) || !isFinite(step) || step <= 0) step = 1;
  min = Math.round(min * 100) / 100;
  max = Math.round(max * 100) / 100;
  step = Math.round(step * 100) / 100;
  if (min < -9999) min = -9999;
  if (max > 9999) max = 9999;
  if (min >= max) {
    max = min + step;
  }
  const range = max - min;
  const steps = Math.floor(range / step);
  if (steps < 1) {
    step = range || 1;
  }
  if (steps > 100) {
    step = +(range / 100).toFixed(2);
    if (step <= 0) step = 1;
  }
  return { ...cfg, min: +min.toFixed(2), max: +max.toFixed(2), step: +step.toFixed(2) };
}

export interface QnaConfig {
  prompt: string;
  anonymous: boolean;
}

export interface InteractiveComponent {
  id: string;
  type: InteractiveType;
  config: PollConfig | WordcloudConfig | RatingConfig | QnaConfig;
  position?: { x: number; y: number; width: number; height: number };
}

export interface Slide {
  id: string;
  index: number;
  title: string;
  content: string;
  background?: string;
  components: InteractiveComponent[];
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface PollResponse {
  id: string;
  componentId: string;
  audienceId: string;
  optionIndices: number[];
  timestamp: string;
}

export interface WordEntry {
  word: string;
  count: number;
  componentId: string;
  audienceId: string;
  timestamp: string;
}

export interface RatingResponse {
  id: string;
  componentId: string;
  audienceId: string;
  rating: number;
  timestamp: string;
}

export interface AudienceQuestion {
  id: string;
  sessionId: string;
  componentId: string;
  content: string;
  isShown: boolean;
  isAnswered: boolean;
  createdAt: string;
  audienceId?: string;
}

export interface Session {
  id: string;
  presentationId: string;
  roomCode: string;
  startedAt: string;
  endedAt?: string;
  currentSlide: number;
  paused: boolean;
  pollResponses: PollResponse[];
  words: Record<string, WordEntry[]>;
  ratingResponses: RatingResponse[];
  questions: AudienceQuestion[];
  audienceIds: string[];
}

export interface PollResult {
  componentId: string;
  totalResponses: number;
  optionCounts: number[];
  optionPercentages: number[];
  multiSelect: boolean;
}

export interface RatingResult {
  componentId: string;
  totalResponses: number;
  average: number;
  min: number;
  max: number;
  distribution: { rating: number; count: number }[];
}

export interface AggregatedWord {
  word: string;
  count: number;
}

export type InsightSeverity = "info" | "warning" | "success" | "danger";
export type InsightType = "low_participation" | "high_divergence" | "high_volatility" | "qa_backlog" | "high_consensus";

export interface ReportInsight {
  type: InsightType;
  severity: InsightSeverity;
  componentId: string;
  slideIndex: number;
  slideTitle: string;
  prompt: string;
  title: string;
  description: string;
  metric: string;
}

export interface ComponentReportSummary {
  componentId: string;
  type: InteractiveType;
  prompt: string;
  totalSubmissions: number;
  uniqueParticipants: number;
  completionRate: number;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
}

export interface ReportData {
  presentation: Presentation;
  session: Session;
  totalAudience: number;
  insights: ReportInsight[];
  slidesReport: {
    slideIndex: number;
    slideTitle: string;
    components: {
      componentId: string;
      type: InteractiveType;
      prompt: string;
      results: PollResult | WordEntry[] | AggregatedWord[] | RatingResult | { questions: AudienceQuestion[] };
      summary: ComponentReportSummary;
    }[];
  }[];
}
