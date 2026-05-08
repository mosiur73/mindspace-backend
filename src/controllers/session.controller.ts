import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { queueEmail } from "../jobs/email.queue";
import { cache } from "../utils/cache";
import { emitNotification } from "../services/socket.service";

export const createSessionSchema = z.object({
  therapistId: z.string().min(1, "Therapist is required"),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date"),
  type: z.enum(["ONLINE", "IN_PERSON"]),
  duration: z.number().int().min(30).max(120).default(50),
});

// POST /api/sessions
export const createSession = async (req: Request, res: Response) => {
  try {
    const { therapistId, date, type, duration } = req.body;
    const userId = req.user!.id;

    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return sendError(res, "Therapist not found", 404);
    if (!therapist.available) return sendError(res, "Therapist is not available", 400);

    const sessionDate = new Date(date);
    if (sessionDate <= new Date()) return sendError(res, "Session date must be in the future", 400);

    const session = await prisma.session.create({
      data: {
        userId,
        therapistId,
        date: sessionDate,
        type,
        duration,
        amount: therapist.price,
        status: "PENDING",
      },
      include: {
        therapist: { include: { user: { select: { name: true, avatar: true } } } },
      },
    });

    // Invalidate stats cache since session count changed
    cache.del("public:stats");

    // Get user info for notification + email
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const therapistUser = await prisma.user.findUnique({ where: { id: therapist.userId }, select: { name: true } });
    const therapistName = therapistUser?.name ?? "your therapist";

    const notif = { title: "Session Booked", message: `Your session with ${therapistName} is booked for ${sessionDate.toLocaleDateString()}.`, type: "booking" };
    await prisma.notification.create({ data: { userId, ...notif } });
    emitNotification(userId, notif);

    // Queue confirmation email
    if (user?.email) {
      await queueEmail({
        to: user.email,
        toName: user.name,
        subject: `Session Booked with ${therapistName}`,
        templateType: "session_booked",
        data: {
          therapistName,
          date: sessionDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          duration: String(duration),
          type: type === "ONLINE" ? "Online" : "In-Person",
          amount: String(therapist.price),
        },
      });
    }

    return sendSuccess(res, "Session booked successfully", session, 201);
  } catch {
    return sendError(res, "Failed to book session", 500);
  }
};

// GET /api/sessions (current user's sessions)
export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      userId,
      ...(status && { status: status as "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" }),
    };

    const [items, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { date: "asc" },
        skip,
        take: limitNum,
        include: {
          therapist: {
            select: {
              id: true,
              price: true,
              specialty: true,
              user: { select: { name: true, avatar: true } },
            },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    return sendSuccess(res, "Sessions fetched", {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch {
    return sendError(res, "Failed to fetch sessions", 500);
  }
};

// PATCH /api/sessions/:id/cancel
export const cancelSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return sendError(res, "Session not found", 404);
    if (session.userId !== userId) return sendError(res, "Forbidden", 403);
    if (session.status !== "PENDING" && session.status !== "CONFIRMED")
      return sendError(res, "Session cannot be cancelled", 400);

    const updated = await prisma.session.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: req.body.reason },
    });

    return sendSuccess(res, "Session cancelled", updated);
  } catch {
    return sendError(res, "Failed to cancel session", 500);
  }
};
