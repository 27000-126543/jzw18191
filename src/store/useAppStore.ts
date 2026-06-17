import { create } from "zustand";
import type {
  Presentation,
  Slide,
  InteractiveComponent,
  PollResult,
  RatingResult,
  WordEntry,
  AudienceQuestion,
} from "../../shared/types";

interface EditorState {
  presentation: Presentation | null;
  activeSlideId: string | null;
  selectedComponentId: string | null;
  setPresentation: (p: Presentation | null) => void;
  setActiveSlide: (id: string | null) => void;
  setSelectedComponent: (id: string | null) => void;
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  addSlide: (afterIndex?: number) => void;
  deleteSlide: (slideId: string) => void;
  addComponent: (slideId: string, component: InteractiveComponent) => void;
  updateComponent: (slideId: string, componentId: string, patch: Partial<InteractiveComponent>) => void;
  deleteComponent: (slideId: string, componentId: string) => void;
}

interface LiveState {
  currentSlideIndex: number;
  paused: boolean;
  roomCode: string | null;
  sessionId: string | null;
  audienceCount: number;
  pollResults: Record<string, PollResult>;
  wordclouds: Record<string, WordEntry[]>;
  ratingResults: Record<string, RatingResult>;
  questions: AudienceQuestion[];
  shownQuestion: AudienceQuestion | null;
  setLive: (patch: Partial<LiveState>) => void;
  addPollResult: (id: string, r: PollResult) => void;
  addWordcloud: (id: string, w: WordEntry[]) => void;
  addRatingResult: (id: string, r: RatingResult) => void;
  addQuestion: (q: AudienceQuestion) => void;
  markQuestionShown: (id: string) => void;
  markQuestionAnswered: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  presentation: null,
  activeSlideId: null,
  selectedComponentId: null,
  setPresentation: (p) => {
    set({
      presentation: p,
      activeSlideId: p?.slides?.[0]?.id ?? null,
      selectedComponentId: null,
    });
  },
  setActiveSlide: (id) => set({ activeSlideId: id, selectedComponentId: null }),
  setSelectedComponent: (id) => set({ selectedComponentId: id }),
  updateSlide: (slideId, patch) => {
    const { presentation } = get();
    if (!presentation) return;
    const slides = presentation.slides.map((s) =>
      s.id === slideId ? { ...s, ...patch } : s,
    );
    set({ presentation: { ...presentation, slides } });
  },
  addSlide: (afterIndex) => {
    const { presentation, activeSlideId } = get();
    if (!presentation) return;
    const activeIdx = presentation.slides.findIndex((s) => s.id === activeSlideId);
    const idx = afterIndex ?? activeIdx;
    const newId = "sl_" + Math.random().toString(36).slice(2, 10);
    const newSlide: Slide = {
      id: newId,
      index: idx + 1,
      title: "新幻灯片",
      content: "",
      components: [],
    };
    const slides = [...presentation.slides];
    slides.splice(idx + 1, 0, newSlide);
    const reindexed = slides.map((s, i) => ({ ...s, index: i }));
    set({
      presentation: { ...presentation, slides: reindexed },
      activeSlideId: newId,
    });
  },
  deleteSlide: (slideId) => {
    const { presentation } = get();
    if (!presentation || presentation.slides.length <= 1) return;
    const idx = presentation.slides.findIndex((s) => s.id === slideId);
    const slides = presentation.slides.filter((s) => s.id !== slideId);
    const reindexed = slides.map((s, i) => ({ ...s, index: i }));
    const nextActive = reindexed[Math.max(0, idx - 1)]?.id ?? null;
    set({
      presentation: { ...presentation, slides: reindexed },
      activeSlideId: nextActive,
      selectedComponentId: null,
    });
  },
  addComponent: (slideId, component) => {
    const { presentation } = get();
    if (!presentation) return;
    const slides = presentation.slides.map((s) =>
      s.id === slideId ? { ...s, components: [...s.components, component] } : s,
    );
    set({ presentation: { ...presentation, slides }, selectedComponentId: component.id });
  },
  updateComponent: (slideId, componentId, patch) => {
    const { presentation } = get();
    if (!presentation) return;
    const slides = presentation.slides.map((s) =>
      s.id === slideId
        ? {
            ...s,
            components: s.components.map((c) =>
              c.id === componentId ? { ...c, ...patch } : c,
            ),
          }
        : s,
    );
    set({ presentation: { ...presentation, slides } });
  },
  deleteComponent: (slideId, componentId) => {
    const { presentation, selectedComponentId } = get();
    if (!presentation) return;
    const slides = presentation.slides.map((s) =>
      s.id === slideId
        ? { ...s, components: s.components.filter((c) => c.id !== componentId) }
        : s,
    );
    set({
      presentation: { ...presentation, slides },
      selectedComponentId:
        selectedComponentId === componentId ? null : selectedComponentId,
    });
  },
}));

const initialLive: Omit<LiveState, keyof { [K in keyof LiveState as LiveState[K] extends Function ? K : never]: never }> = {
  currentSlideIndex: 0,
  paused: false,
  roomCode: null,
  sessionId: null,
  audienceCount: 0,
  pollResults: {},
  wordclouds: {},
  ratingResults: {},
  questions: [],
  shownQuestion: null,
};

export const useLiveStore = create<LiveState>((set) => ({
  ...initialLive,
  setLive: (patch) => set((s) => ({ ...s, ...patch })),
  addPollResult: (id, r) => set((s) => ({ pollResults: { ...s.pollResults, [id]: r } })),
  addWordcloud: (id, w) => set((s) => ({ wordclouds: { ...s.wordclouds, [id]: w } })),
  addRatingResult: (id, r) =>
    set((s) => ({ ratingResults: { ...s.ratingResults, [id]: r } })),
  addQuestion: (q) =>
    set((s) => {
      if (s.questions.find((x) => x.id === q.id)) return {};
      return { questions: [...s.questions, q] };
    }),
  markQuestionShown: (id) =>
    set((s) => {
      const q = s.questions.find((x) => x.id === id);
      const questions = s.questions.map((x) =>
        x.id === id ? { ...x, isShown: true } : x,
      );
      return { questions, shownQuestion: q ? { ...q, isShown: true } : s.shownQuestion };
    }),
  markQuestionAnswered: (id) =>
    set((s) => ({
      questions: s.questions.map((x) =>
        x.id === id ? { ...x, isAnswered: true } : x,
      ),
    })),
}));

export function useAudienceId(): string {
  let id = typeof localStorage !== "undefined" ? localStorage.getItem("aud_id") : null;
  if (!id) {
    id = "aud_" + Math.random().toString(36).slice(2, 14);
    try {
      localStorage.setItem("aud_id", id);
    } catch {
      /* ignore */
    }
  }
  return id;
}
