import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { cache } from "../utils/cache";

export const createReviewSchema = z.object({
  therapistId: z.string().min(1),
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// POST /api/reviews
export const createReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { therapistId, sessionId, rating, comment } = req.body;

    // Verify the session belongs to user and is COMPLETED
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return sendError(res, "Session not found", 404);
    if (session.userId !== userId) return sendError(res, "Forbidden", 403);
    if (session.status !== "COMPLETED") return sendError(res, "You can only review completed sessions", 400);

    // Prevent duplicate review
    const existing = await prisma.review.findUnique({ where: { userId_therapistId: { userId, therapistId } } });
    if (existing) return sendError(res, "You have already reviewed this therapist", 409);

    // Create review
    const review = await prisma.review.create({
      data: { userId, therapistId, rating, comment },
      include: { user: { select: { name: true, avatar: true } } },
    });

    // Recalculate therapist rating
    const agg = await prisma.review.aggregate({
      where: { therapistId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.therapist.update({
      where: { id: therapistId },
      data: {
        rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        totalReviews: agg._count.rating,
      },
    });

    // Invalidate therapist cache
    cache.del(`therapist:${therapistId}`);

    return sendSuccess(res, "Review submitted", review, 201);
  } catch {
    return sendError(res, "Failed to submit review", 500);
  }
};

// GET /api/reviews/check?therapistId=xxx&sessionId=xxx
export const checkReviewed = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { therapistId } = req.query as Record<string, string>;
    const review = await prisma.review.findUnique({
      where: { userId_therapistId: { userId, therapistId } },
    });
    return sendSuccess(res, "Check done", { reviewed: !!review });
  } catch {
    return sendError(res, "Failed to check review", 500);
  }
};
