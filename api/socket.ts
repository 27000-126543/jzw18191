import type { Server as HTTPServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import {
  sessions,
  sessionsByRoom,
  presentations,
  persistSessions,
  genId,
  calculatePollResult,
  calculateRatingResult,
} from "./store.js";
import type {
  Session,
  InteractiveComponent,
  PollResponse,
  RatingResponse,
  AudienceQuestion,
  PollConfig,
  WordEntry,
} from "../shared/types.js";

let io: IOServer | null = null;

function getSessionByPresentation(presentationId: string): Session | undefined {
  return Array.from(sessions.values()).find(
    (s) => s.presentationId === presentationId && !s.endedAt,
  );
}

function getPresentationBySession(session: Session) {
  return presentations.get(session.presentationId);
}

function aggregateWordcloud(entries: WordEntry[]): { word: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.word, (map.get(e.word) ?? 0) + e.count);
  }
  return Array.from(map, ([word, count]) => ({ word, count }));
}

export function setupSocket(server: HTTPServer): void {
  io = new IOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket: Socket) => {
    socket.on("presenter:join", ({ presentationId }: { presentationId: string }) => {
      const session = getSessionByPresentation(presentationId);
      if (!session) {
        socket.emit("error", { message: "无进行中的演示，请先开始演示" });
        return;
      }
      const presentation = getPresentationBySession(session);
      socket.join(`pres:${session.id}`);
      socket.data.sessionId = session.id;
      socket.data.role = "presenter";
      socket.emit("presenter:joined", {
        sessionId: session.id,
        roomCode: session.roomCode,
        currentSlide: session.currentSlide,
        paused: session.paused,
      });
      if (presentation) {
        const currentSlide = presentation.slides[session.currentSlide];
        if (currentSlide) {
          broadcastCurrentResults(session, currentSlide.components);
        }
      }
    });

    socket.on(
      "presenter:navigate",
      ({ presentationId, slideIndex }: { presentationId: string; slideIndex: number }) => {
        const session = getSessionByPresentation(presentationId);
        if (!session) return;
        const presentation = getPresentationBySession(session);
        if (!presentation) return;
        if (slideIndex < 0 || slideIndex >= presentation.slides.length) return;
        session.currentSlide = slideIndex;
        persistSessions();
        const slide = presentation.slides[slideIndex];
        io?.to(`aud:${session.id}`).emit("slide:changed", {
          slideIndex,
          slide,
          interactiveComponents: slide.components,
        });
        io?.to(`pres:${session.id}`).emit("presenter:navigated", { slideIndex, slide });
        broadcastCurrentResults(session, slide.components);
      },
    );

    socket.on(
      "presenter:pause",
      ({ presentationId, paused }: { presentationId: string; paused: boolean }) => {
        const session = getSessionByPresentation(presentationId);
        if (!session) return;
        session.paused = paused;
        persistSessions();
        io?.to(`aud:${session.id}`).emit("presentation:paused", { paused });
        io?.to(`pres:${session.id}`).emit("presentation:paused", { paused });
      },
    );

    socket.on("presenter:end", ({ presentationId, sessionId }: { presentationId: string; sessionId?: string }) => {
      let session: Session | undefined;
      if (sessionId) {
        session = sessions.get(sessionId);
      } else {
        session = Array.from(sessions.values()).find(
          (s) => s.presentationId === presentationId,
        );
      }
      if (!session) return;
      if (!session.endedAt) {
        session.endedAt = new Date().toISOString();
        persistSessions();
      }
      io?.to(`aud:${session.id}`).emit("presentation:ended");
      io?.to(`pres:${session.id}`).emit("presentation:ended", { sessionId: session.id });
    });

    socket.on(
      "presenter:showQuestion",
      ({ presentationId, questionId }: { presentationId: string; questionId: string }) => {
        const session = getSessionByPresentation(presentationId);
        if (!session) return;
        const q = session.questions.find((x) => x.id === questionId);
        if (!q) return;
        q.isShown = true;
        persistSessions();
        io?.to(`aud:${session.id}`).emit("question:show", { question: q });
        io?.to(`pres:${session.id}`).emit("question:show", { question: q });
      },
    );

    socket.on(
      "presenter:markAnswered",
      ({ presentationId, questionId }: { presentationId: string; questionId: string }) => {
        const session = getSessionByPresentation(presentationId);
        if (!session) return;
        const q = session.questions.find((x) => x.id === questionId);
        if (!q) return;
        q.isAnswered = true;
        persistSessions();
        io?.to(`pres:${session.id}`).emit("question:answered", { questionId });
      },
    );

    socket.on(
      "audience:join",
      ({ roomCode, audienceId }: { roomCode: string; audienceId: string }) => {
        const sid = sessionsByRoom.get(roomCode.toUpperCase());
        if (!sid) {
          socket.emit("error", { message: "房间不存在" });
          return;
        }
        const session = sessions.get(sid);
        if (!session) return;
        if (!session.audienceIds.includes(audienceId)) {
          session.audienceIds.push(audienceId);
          persistSessions();
        }
        io?.to(`pres:${session.id}`).emit("audience:count", {
          count: session.audienceIds.length,
        });
        socket.join(`aud:${session.id}`);
        socket.data.sessionId = session.id;
        socket.data.role = "audience";
        socket.data.audienceId = audienceId;
        const presentation = getPresentationBySession(session);
        const slide = presentation?.slides[session.currentSlide];
        socket.emit("room:joined", {
          success: true,
          presentationId: session.presentationId,
          currentSlide: session.currentSlide,
          interactiveComponents: slide?.components ?? [],
          paused: session.paused,
        });
        if (slide) {
          broadcastCurrentResultsToAudience(session, slide.components, socket.id);
        }
      },
    );

    socket.on(
      "audience:submitPoll",
      ({
        roomCode,
        componentId,
        optionIndex,
        optionIndices,
      }: {
        roomCode: string;
        componentId: string;
        optionIndex?: number;
        optionIndices?: number[];
      }) => {
        const sid = sessionsByRoom.get(roomCode.toUpperCase());
        if (!sid) return;
        const session = sessions.get(sid);
        if (!session) return;
        const audienceId = socket.data.audienceId as string;
        const selected = optionIndices ?? (optionIndex !== undefined ? [optionIndex] : []);
        session.pollResponses = session.pollResponses.filter(
          (r) => !(r.componentId === componentId && r.audienceId === audienceId),
        );
        const resp: PollResponse = {
          id: genId("pr_"),
          componentId,
          audienceId,
          optionIndices: selected,
          timestamp: new Date().toISOString(),
        };
        session.pollResponses.push(resp);
        persistSessions();
        const presentation = getPresentationBySession(session);
        const comp = findComponentById(presentation, componentId);
        if (comp) {
          const result = calculatePollResult(session, comp);
          io?.to(`aud:${session.id}`).emit("poll:update", { componentId, results: result });
          io?.to(`pres:${session.id}`).emit("poll:update", { componentId, results: result });
        }
      },
    );

    socket.on(
      "audience:submitWord",
      ({ roomCode, componentId, word }: { roomCode: string; componentId: string; word: string }) => {
        const sid = sessionsByRoom.get(roomCode.toUpperCase());
        if (!sid) return;
        const session = sessions.get(sid);
        if (!session) return;
        const clean = word.trim().slice(0, 20);
        if (!clean) return;
        const audienceId = socket.data.audienceId as string;
        const list = session.words[componentId] ?? (session.words[componentId] = []);
        list.push({
          word: clean,
          count: 1,
          componentId,
          audienceId,
          timestamp: new Date().toISOString(),
        });
        const agg = aggregateWordcloud(list);
        persistSessions();
        io?.to(`aud:${session.id}`).emit("wordcloud:update", { componentId, words: agg });
        io?.to(`pres:${session.id}`).emit("wordcloud:update", { componentId, words: agg });
      },
    );

    socket.on(
      "audience:submitRating",
      ({ roomCode, componentId, rating }: { roomCode: string; componentId: string; rating: number }) => {
        const sid = sessionsByRoom.get(roomCode.toUpperCase());
        if (!sid) return;
        const session = sessions.get(sid);
        if (!session) return;
        const audienceId = socket.data.audienceId as string;
        session.ratingResponses = session.ratingResponses.filter(
          (r) => !(r.componentId === componentId && r.audienceId === audienceId),
        );
        const resp: RatingResponse = {
          id: genId("rr_"),
          componentId,
          audienceId,
          rating,
          timestamp: new Date().toISOString(),
        };
        session.ratingResponses.push(resp);
        persistSessions();
        const presentation = getPresentationBySession(session);
        const comp = findComponentById(presentation, componentId);
        if (comp) {
          const result = calculateRatingResult(session, comp);
          io?.to(`aud:${session.id}`).emit("rating:update", { componentId, results: result });
          io?.to(`pres:${session.id}`).emit("rating:update", { componentId, results: result });
        }
      },
    );

    socket.on(
      "audience:askQuestion",
      ({ roomCode, componentId, question }: { roomCode: string; componentId: string; question: string }) => {
        const sid = sessionsByRoom.get(roomCode.toUpperCase());
        if (!sid) return;
        const session = sessions.get(sid);
        if (!session) return;
        const audienceId = socket.data.audienceId as string;
        const q: AudienceQuestion = {
          id: genId("q_"),
          sessionId: session.id,
          componentId: componentId || "",
          content: question.trim().slice(0, 500),
          isShown: false,
          isAnswered: false,
          createdAt: new Date().toISOString(),
          audienceId,
        };
        if (!q.content) return;
        session.questions.push(q);
        persistSessions();
        io?.to(`pres:${session.id}`).emit("question:new", { question: q });
      },
    );

    socket.on("disconnect", () => {
      // 可以在此处理离开逻辑
    });
  });
}

function findComponentById(
  presentation: ReturnType<typeof getPresentationBySession>,
  componentId: string,
): InteractiveComponent | undefined {
  if (!presentation) return undefined;
  for (const slide of presentation.slides) {
    const c = slide.components.find((x) => x.id === componentId);
    if (c) return c;
  }
  return undefined;
}

function broadcastCurrentResults(session: Session, components: InteractiveComponent[]): void {
  for (const comp of components) {
    if (comp.type === "poll") {
      const r = calculatePollResult(session, comp);
      io?.to(`aud:${session.id}`).emit("poll:update", { componentId: comp.id, results: r });
      io?.to(`pres:${session.id}`).emit("poll:update", { componentId: comp.id, results: r });
    } else if (comp.type === "wordcloud") {
      const w = session.words[comp.id] ?? [];
      const agg = aggregateWordcloud(w);
      io?.to(`aud:${session.id}`).emit("wordcloud:update", { componentId: comp.id, words: agg });
      io?.to(`pres:${session.id}`).emit("wordcloud:update", { componentId: comp.id, words: agg });
    } else if (comp.type === "rating") {
      const r = calculateRatingResult(session, comp);
      io?.to(`aud:${session.id}`).emit("rating:update", { componentId: comp.id, results: r });
      io?.to(`pres:${session.id}`).emit("rating:update", { componentId: comp.id, results: r });
    }
  }
}

function broadcastCurrentResultsToAudience(
  session: Session,
  components: InteractiveComponent[],
  socketId: string,
): void {
  for (const comp of components) {
    if (comp.type === "poll") {
      const r = calculatePollResult(session, comp);
      io?.to(socketId).emit("poll:update", { componentId: comp.id, results: r });
    } else if (comp.type === "wordcloud") {
      const w = session.words[comp.id] ?? [];
      io?.to(socketId).emit("wordcloud:update", { componentId: comp.id, words: w });
    } else if (comp.type === "rating") {
      const r = calculateRatingResult(session, comp);
      io?.to(socketId).emit("rating:update", { componentId: comp.id, results: r });
    }
  }
}




