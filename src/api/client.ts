import type {
  Presentation,
  Session,
  ReportData,
  Slide,
  InteractiveComponent,
} from "../../shared/types";

const API_BASE = "/api";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

export interface PresentationListItem {
  id: string;
  title: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  listPresentations: () =>
    request<PresentationListItem[]>("/presentations", { method: "GET" }),

  createPresentation: (title: string) =>
    request<Presentation>("/presentations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  getPresentation: (id: string) =>
    request<Presentation>(`/presentations/${id}`, { method: "GET" }),

  updatePresentation: (id: string, data: Partial<Presentation>) =>
    request<Presentation>(`/presentations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deletePresentation: (id: string) =>
    request<boolean>(`/presentations/${id}`, { method: "DELETE" }),

  startSession: (id: string) =>
    request<Session>(`/presentations/${id}/start`, { method: "POST" }),

  endSession: (id: string) =>
    request<{ sessionId: string }>(`/presentations/${id}/end`, { method: "POST" }),

  getActiveSession: (id: string) =>
    request<Session | null>(`/presentations/${id}/active-session`, { method: "GET" }),

  getReport: (presentationId: string, sessionId: string) =>
    request<ReportData>(`/presentations/${presentationId}/report/${sessionId}`, {
      method: "GET",
    }),

  exportCsv: (presentationId: string, sessionId: string) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/presentations/${presentationId}/export/${sessionId}/csv`;
    a.download = `report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  getPresentationByRoomCode: (code: string) =>
    request<{
      sessionId: string;
      presentationId: string;
      currentSlideIndex: number;
      currentSlide: Slide;
      interactiveComponents: InteractiveComponent[];
      paused: boolean;
    }>(`/presentations/room/${code.toUpperCase()}/presentation`, { method: "GET" }),
};
