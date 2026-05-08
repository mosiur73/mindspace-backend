import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";

export const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// POST /api/newsletter/subscribe
export const subscribe = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };
    await prisma.newsletter.upsert({
      where: { email },
      create: { email },
      update: {},
    });
    return sendSuccess(res, "Subscribed successfully");
  } catch {
    return sendError(res, "Failed to subscribe", 500);
  }
};

// GET /api/newsletter (admin)
export const getSubscribers = async (_req: Request, res: Response) => {
  try {
    const [subscribers, total] = await Promise.all([
      prisma.newsletter.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.newsletter.count(),
    ]);
    return sendSuccess(res, "Subscribers fetched", { subscribers, total });
  } catch {
    return sendError(res, "Failed to fetch subscribers", 500);
  }
};
