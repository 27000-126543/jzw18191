import express, { type Request, type Response } from "express";
import {
  presentations,
  sessions,
  sessionsByRoom,
  createPresentation,
  savePresentation,
  deletePresentation,
  createSession,
  endSession,
  buildReport,
  genId,
} from "../store.js";
import type {
  Presentation,
  PollResult,
  RatingResult,
  WordEntry,
  AudienceQuestion,
} from "../../shared/types.js";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  const list = Array.from(presentations.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, slides, createdAt, updatedAt }) => ({
      id,
      title,
      slideCount: slides.length,
      createdAt,
      updatedAt,
    }));
  res.json({ success: true, data: list });
});

router.post("/", (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ success: false, error: "标题不能为空" });
  }
  const p = createPresentation(title.trim());
  res.json({ success: true, data: p });
});

router.get("/:id", (req: Request, res: Response) => {
  const p = presentations.get(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: "演示文稿不存在" });
  res.json({ success: true, data: p });
});

router.put("/:id", (req: Request, res: Response) => {
  const existing = presentations.get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "演示文稿不存在" });
  const data = req.body as Partial<Presentation>;
  const updated: Presentation = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    slides: data.slides ?? existing.slides,
  };
  savePresentation(updated);
  res.json({ success: true, data: updated });
});

router.delete("/:id", (req: Request, res: Response) => {
  const ok = deletePresentation(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: "演示文稿不存在" });
  res.json({ success: true, data: { deleted: true } });
});

router.post("/:id/start", (req: Request, res: Response) => {
  const session = createSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: "演示文稿不存在" });
  res.json({ success: true, data: session });
});

router.post("/:id/end", (req: Request, res: Response) => {
  const session = Array.from(sessions.values()).find(
    (s) => s.presentationId === req.params.id && !s.endedAt,
  );
  if (!session) return res.status(404).json({ success: false, error: "无进行中的演示" });
  endSession(session.id);
  res.json({ success: true, data: { sessionId: session.id } });
});

router.get("/:id/active-session", (req: Request, res: Response) => {
  const session = Array.from(sessions.values()).find(
    (s) => s.presentationId === req.params.id && !s.endedAt,
  );
  res.json({ success: true, data: session ?? null });
});

router.get("/:id/report/:sessionId", (req: Request, res: Response) => {
  const report = buildReport(req.params.id, req.params.sessionId);
  if (!report) return res.status(404).json({ success: false, error: "报告数据不存在" });
  res.json({ success: true, data: report });
});

router.get("/:id/export/:sessionId/csv", (req: Request, res: Response) => {
  const report = buildReport(req.params.id, req.params.sessionId);
  if (!report) return res.status(404).json({ success: false, error: "报告数据不存在" });
  const lines: string[] = [];
  lines.push(`互动演示数据报告 - ${report.presentation.title}`);
  lines.push(`总参与人数,${report.totalAudience}`);
  lines.push(`开始时间,${report.session.startedAt}`);
  lines.push(`结束时间,${report.session.endedAt ?? "进行中"}`);
  lines.push("");
  lines.push("--- 投票/评分数据 ---");
  for (const slide of report.slidesReport) {
    for (const comp of slide.components) {
      lines.push(`幻灯片${slide.slideIndex + 1}: ${slide.slideTitle} - ${comp.prompt}`);
      if (comp.type === "poll") {
        const r = comp.results as PollResult;
        lines.push(`参与人数,${r.totalResponses}`);
        lines.push("选项,票数,占比(%)");
        const cfg = report.presentation.slides[slide.slideIndex]?.components.find(
          (c) => c.id === comp.componentId,
        )?.config as { options: string[] } | undefined;
        if (cfg) {
          cfg.options.forEach((opt, i) => {
            lines.push(`"${opt}",${r.optionCounts[i]},${r.optionPercentages[i]}`);
          });
        }
      } else if (comp.type === "rating") {
        const r = comp.results as RatingResult;
        lines.push(`参与人数,${r.totalResponses}`);
        lines.push(`平均分,${r.average}`);
        lines.push("分值,票数");
        r.distribution.forEach((d) => lines.push(`${d.rating},${d.count}`));
      } else if (comp.type === "wordcloud") {
        const w = comp.results as WordEntry[];
        lines.push(`词汇总数,${w.reduce((s, x) => s + x.count, 0)}`);
        lines.push("词汇,出现次数");
        w.forEach((x) => lines.push(`"${x.word}",${x.count}`));
      } else if (comp.type === "qna") {
        const q = (comp.results as { questions: AudienceQuestion[] }).questions;
        lines.push(`问题总数,${q.length}`);
        lines.push("时间,内容,已展示,已回答");
        q.forEach((x) =>
          lines.push(`${x.createdAt},"${x.content.replace(/"/g, '""')}",${x.isShown},${x.isAnswered}`),
        );
      }
      lines.push("");
    }
  }
  const csv = "\uFEFF" + lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report-${report.presentation.title}-${Date.now()}.csv"`,
  );
  res.send(csv);
});

router.get("/room/:code/presentation", (req: Request, res: Response) => {
  const sessionId = sessionsByRoom.get(req.params.code.toUpperCase());
  if (!sessionId) return res.status(404).json({ success: false, error: "房间不存在" });
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ success: false, error: "房间不存在" });
  const presentation = presentations.get(session.presentationId);
  if (!presentation) return res.status(404).json({ success: false, error: "演示文稿不存在" });
  const currentSlide = presentation.slides[session.currentSlide];
  res.json({
    success: true,
    data: {
      sessionId: session.id,
      presentationId: presentation.id,
      currentSlideIndex: session.currentSlide,
      currentSlide,
      interactiveComponents: currentSlide?.components ?? [],
      paused: session.paused,
    },
  });
});

export default router;

// 为了防止 lint 提示 genId 未使用
void genId;
