import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { analyzeMoodPattern } from "../services/ai.service";

export const createMoodSchema = z.object({
  score: z.number().int().min(1).max(10),
  note: z.string().max(500).optional(),
});

// POST /api/moods
export const logMood = async (req: Request, res: Response) => {
  try {
    const { score, note } = req.body;
    const userId = req.user!.id;

    const log = await prisma.moodLog.create({ data: { userId, score, note } });
    return sendSuccess(res, "Mood logged", log, 201);
  } catch {
    return sendError(res, "Failed to log mood", 500);
  }
};

// GET /api/moods  (last 30 days)
export const getMoodLogs = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = parseInt((req.query.days as string) || "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.moodLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });

    return sendSuccess(res, "Mood logs fetched", logs);
  } catch {
    return sendError(res, "Failed to fetch mood logs", 500);
  }
};

// GET /api/moods/today
export const getTodayMood = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const log = await prisma.moodLog.findFirst({
      where: { userId, createdAt: { gte: startOfDay } },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, "Today mood fetched", log);
  } catch {
    return sendError(res, "Failed to fetch today mood", 500);
  }
};

// POST /api/moods/analyze
export const analyzeMoods = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const logs = await prisma.moodLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });

    if (logs.length < 3) {
      return sendError(res, "Not enough mood data. Log your mood for at least 3 days first.", 400);
    }

    const pattern = await analyzeMoodPattern(logs);
    return sendSuccess(res, "Mood pattern analyzed", pattern);
  } catch {
    return sendError(res, "Failed to analyze mood patterns", 500);
  }
};
