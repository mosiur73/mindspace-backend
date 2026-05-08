import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { chatWithAssistant, recommendTherapistSpecialties } from "../services/ai.service";

const CHAT_HISTORY_LIMIT = 20;
const CONTEXT_WINDOW = 10;

// GET /api/ai/chat
export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "asc" },
      take: CHAT_HISTORY_LIMIT,
    });
    return sendSuccess(res, "Chat history fetched", messages);
  } catch {
    return sendError(res, "Failed to fetch chat history", 500);
  }
};

// POST /api/ai/chat
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return sendError(res, "Message is required", 400);

    const userId = req.user!.id;

    // Save user message
    await prisma.chatMessage.create({ data: { userId, role: "user", content: message.trim() } });

    // Get recent history for context (last N messages)
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: CONTEXT_WINDOW,
    });
    const contextHistory = history.reverse().slice(0, -1); // exclude the message we just saved

    // Get AI response
    const aiResponse = await chatWithAssistant(message.trim(), contextHistory.map((m) => ({ role: m.role, content: m.content })));

    // Save AI response
    const saved = await prisma.chatMessage.create({ data: { userId, role: "assistant", content: aiResponse } });

    return sendSuccess(res, "Message sent", { message: saved });
  } catch {
    return sendError(res, "Failed to send message", 500);
  }
};

// DELETE /api/ai/chat
export const clearChatHistory = async (req: Request, res: Response) => {
  try {
    await prisma.chatMessage.deleteMany({ where: { userId: req.user!.id } });
    return sendSuccess(res, "Chat history cleared");
  } catch {
    return sendError(res, "Failed to clear chat history", 500);
  }
};

// POST /api/ai/recommend
export const getTherapistRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { concerns = [] } = req.body as { concerns: string[] };

    // Gather user data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [moodLogs, journals] = await Promise.all([
      prisma.moodLog.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { score: true } }),
      prisma.journal.findMany({
        where: { userId, NOT: { aiAnalysis: undefined } },
        select: { aiAnalysis: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const avgMood = moodLogs.length > 0
      ? moodLogs.reduce((s, l) => s + l.score, 0) / moodLogs.length
      : 5;

    // Extract themes from journal analyses
    const journalThemes = journals
      .flatMap((j) => {
        const analysis = j.aiAnalysis as { themes?: string[] } | null;
        return analysis?.themes ?? [];
      })
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 8);

    // Get AI recommendations
    const recommendation = await recommendTherapistSpecialties(avgMood, journalThemes, concerns);

    // Find matching therapists from DB
    const matchingTherapists = await prisma.therapist.findMany({
      where: {
        verified: true,
        available: true,
        specialty: { hasSome: recommendation.specialties },
      },
      take: 3,
      orderBy: { rating: "desc" },
      include: { user: { select: { name: true, avatar: true } } },
    });

    // Calculate match scores
    const therapistsWithScore = matchingTherapists.map((t) => {
      const matchCount = t.specialty.filter((s) => recommendation.specialties.includes(s)).length;
      const matchScore = Math.min(99, Math.round((matchCount / recommendation.specialties.length) * 70 + t.rating * 4 + Math.random() * 10));
      const matchedSpecialties = t.specialty.filter((s) => recommendation.specialties.includes(s));
      return {
        therapist: t,
        matchScore,
        matchReason: `Specializes in ${matchedSpecialties.slice(0, 2).join(" and ")}, which aligns with your primary needs.`,
      };
    });

    therapistsWithScore.sort((a, b) => b.matchScore - a.matchScore);

    return sendSuccess(res, "Recommendations fetched", {
      avgMood: Math.round(avgMood * 10) / 10,
      journalThemes,
      recommendation,
      therapists: therapistsWithScore,
    });
  } catch {
    return sendError(res, "Failed to get recommendations", 500);
  }
};
