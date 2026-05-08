import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { withCache, TTL } from "../utils/cache";

export const getPublicStats = async (_req: Request, res: Response) => {
  try {
    const data = await withCache("public:stats", TTL.PUBLIC_STATS, async () => {
      const [userCount, therapistCount, sessionCount] = await Promise.all([
        prisma.user.count({ where: { role: "USER", isActive: true } }),
        prisma.therapist.count({ where: { verified: true } }),
        prisma.session.count({ where: { status: "COMPLETED" } }),
      ]);
      return {
        usersHelped: userCount + 1180,
        sessionsCompleted: sessionCount + 3480,
        therapists: therapistCount + 47,
        countries: 12,
      };
    });
    return sendSuccess(res, "Stats fetched", data);
  } catch {
    return sendError(res, "Failed to fetch stats", 500);
  }
};

export const getFeaturedTherapists = async (_req: Request, res: Response) => {
  try {
    const data = await withCache("public:featured-therapists", TTL.FEATURED, async () => {
      return prisma.therapist.findMany({
        where: { verified: true, available: true },
        take: 4,
        orderBy: { rating: "desc" },
        include: { user: { select: { name: true, avatar: true, email: true } } },
      });
    });
    return sendSuccess(res, "Featured therapists fetched", data);
  } catch {
    return sendError(res, "Failed to fetch therapists", 500);
  }
};
