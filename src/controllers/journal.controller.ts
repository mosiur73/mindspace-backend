import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { analyzeJournal } from "../services/ai.service";

export const createJournalSchema = z.object({
  content: z.string().min(10, "Journal entry must be at least 10 characters"),
  moodScore: z.number().int().min(1).max(10),
});

export const updateJournalSchema = z.object({
  content: z.string().min(10).optional(),
  moodScore: z.number().int().min(1).max(10).optional(),
});

// POST /api/journals
export const createJournal = async (req: Request, res: Response) => {
  try {
    const { content, moodScore } = req.body;
    const userId = req.user!.id;

    const journal = await prisma.journal.create({
      data: { userId, content, moodScore },
    });

    return sendSuccess(res, "Journal entry created", journal, 201);
  } catch {
    return sendError(res, "Failed to create journal entry", 500);
  }
};

// GET /api/journals
export const getJournals = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(20, parseInt((req.query.limit as string) || "10", 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.journal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.journal.count({ where: { userId } }),
    ]);

    return sendSuccess(res, "Journals fetched", {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return sendError(res, "Failed to fetch journals", 500);
  }
};

// GET /api/journals/:id
export const getJournal = async (req: Request, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.userId !== req.user!.id) return sendError(res, "Not found", 404);
    return sendSuccess(res, "Journal fetched", journal);
  } catch {
    return sendError(res, "Failed to fetch journal", 500);
  }
};

// PATCH /api/journals/:id
export const updateJournal = async (req: Request, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.userId !== req.user!.id) return sendError(res, "Not found", 404);

    const updated = await prisma.journal.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return sendSuccess(res, "Journal updated", updated);
  } catch {
    return sendError(res, "Failed to update journal", 500);
  }
};

// DELETE /api/journals/:id
export const deleteJournal = async (req: Request, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.userId !== req.user!.id) return sendError(res, "Not found", 404);
    await prisma.journal.delete({ where: { id: req.params.id } });
    return sendSuccess(res, "Journal deleted");
  } catch {
    return sendError(res, "Failed to delete journal", 500);
  }
};

// POST /api/journals/:id/analyze
export const analyzeJournalEntry = async (req: Request, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.userId !== req.user!.id) return sendError(res, "Not found", 404);

    const analysis = await analyzeJournal(journal.content);

    const updated = await prisma.journal.update({
      where: { id: req.params.id },
      data: { aiAnalysis: analysis as object },
    });

    return sendSuccess(res, "Journal analyzed", { analysis, journal: updated });
  } catch {
    return sendError(res, "Failed to analyze journal", 500);
  }
};
