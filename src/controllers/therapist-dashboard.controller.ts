import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { emitNotification } from "../services/socket.service";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary";

const getTherapist = async (userId: string) => {
  const t = await prisma.therapist.findUnique({ where: { userId } });
  if (!t) throw new Error("Therapist profile not found");
  return t;
};

// GET /api/therapist-dashboard/stats
export const getStats = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [todayCount, completedCount, clientGroups, monthEarnings, totalEarnings, allRecentSessions] = await Promise.all([
      prisma.session.count({ where: { therapistId: therapist.id, date: { gte: today, lt: tomorrow } } }),
      prisma.session.count({ where: { therapistId: therapist.id, status: "COMPLETED" } }),
      prisma.session.groupBy({ by: ["userId"], where: { therapistId: therapist.id } }),
      prisma.session.aggregate({ where: { therapistId: therapist.id, status: "COMPLETED", date: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.session.aggregate({ where: { therapistId: therapist.id, status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.session.findMany({ where: { therapistId: therapist.id, date: { gte: sixMonthsAgo } }, select: { date: true, amount: true, status: true } }),
    ]);

    // Today schedule
    const todaySchedule = await prisma.session.findMany({
      where: { therapistId: therapist.id, date: { gte: today, lt: tomorrow } },
      orderBy: { date: "asc" },
      include: { user: { select: { name: true, avatar: true } } },
    });

    // Monthly earnings chart (last 6 months)
    const earningsByMonth: Record<string, number> = {};
    allRecentSessions.filter(s => s.status === "COMPLETED").forEach(s => {
      const key = new Date(s.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      earningsByMonth[key] = (earningsByMonth[key] || 0) + s.amount;
    });

    // Sessions per week (last 4 weeks)
    const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const sessionsByWeek: Record<string, number> = {};
    allRecentSessions.filter(s => new Date(s.date) >= fourWeeksAgo).forEach(s => {
      const d = new Date(s.date);
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
      const key = `W${Math.ceil((d.getDate()) / 7)} ${weekStart.toLocaleDateString("en-US", { month: "short" })}`;
      sessionsByWeek[key] = (sessionsByWeek[key] || 0) + 1;
    });

    return sendSuccess(res, "Stats fetched", {
      todaySessions: todayCount,
      totalClients: clientGroups.length,
      monthlyEarnings: monthEarnings._sum.amount ?? 0,
      totalEarnings: totalEarnings._sum.amount ?? 0,
      completedSessions: completedCount,
      rating: therapist.rating,
      totalReviews: therapist.totalReviews,
      todaySchedule,
      earningsChart: Object.entries(earningsByMonth).map(([month, amount]) => ({ month, amount })),
      sessionsChart: Object.entries(sessionsByWeek).map(([week, count]) => ({ week, count })),
    });
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Failed to fetch stats", 500);
  }
};

// GET /api/therapist-dashboard/appointments
export const getAppointments = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const { status, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(20, parseInt(limit, 10));

    const where = {
      therapistId: therapist.id,
      ...(status && status !== "ALL" && { status: status as "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" }),
    };

    const [items, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { date: "asc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { user: { select: { name: true, avatar: true, email: true } } },
      }),
      prisma.session.count({ where }),
    ]);

    return sendSuccess(res, "Appointments fetched", { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Failed to fetch appointments", 500);
  }
};

// PATCH /api/therapist-dashboard/appointments/:id/status
export const updateAppointmentStatus = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const { id } = req.params;
    const { status } = req.body;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.therapistId !== therapist.id) return sendError(res, "Not found", 404);

    const allowed: Record<string, string[]> = {
      CONFIRMED: ["PENDING"],
      COMPLETED: ["CONFIRMED"],
      CANCELLED: ["PENDING", "CONFIRMED"],
    };
    if (!allowed[status]?.includes(session.status)) {
      return sendError(res, `Cannot change status from ${session.status} to ${status}`, 400);
    }

    const updated = await prisma.session.update({ where: { id }, data: { status } });

    const notifMap: Record<string, { title: string; message: string }> = {
      CONFIRMED: { title: "Session Confirmed", message: "Your upcoming session has been confirmed by your therapist." },
      COMPLETED: { title: "Session Completed", message: "Your therapy session has been marked as completed. Leave a review!" },
      CANCELLED: { title: "Session Cancelled", message: "Your session has been cancelled by the therapist." },
    };
    if (notifMap[status]) {
      const notif = { ...notifMap[status], type: "session" };
      await prisma.notification.create({ data: { userId: session.userId, ...notif } });
      emitNotification(session.userId, notif);
    }

    return sendSuccess(res, "Status updated", updated);
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Failed to update status", 500);
  }
};

// GET /api/therapist-dashboard/clients
export const getClients = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const clientGroups = await prisma.session.groupBy({ by: ["userId"], where: { therapistId: therapist.id } });
    const userIds = clientGroups.map(c => c.userId);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });

    const clients = await Promise.all(users.map(async (user) => {
      const [total, last] = await Promise.all([
        prisma.session.count({ where: { therapistId: therapist.id, userId: user.id } }),
        prisma.session.findFirst({ where: { therapistId: therapist.id, userId: user.id }, orderBy: { date: "desc" }, select: { date: true, status: true } }),
      ]);
      return { ...user, totalSessions: total, lastSession: last?.date, lastStatus: last?.status };
    }));

    return sendSuccess(res, "Clients fetched", clients);
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Failed to fetch clients", 500);
  }
};

// GET /api/therapist-dashboard/earnings
export const getEarnings = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const { page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10);

    const [totalEarnings, monthEarnings, pendingEarnings, transactions, total] = await Promise.all([
      prisma.session.aggregate({ where: { therapistId: therapist.id, status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.session.aggregate({ where: { therapistId: therapist.id, status: "COMPLETED", date: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.session.aggregate({ where: { therapistId: therapist.id, status: "CONFIRMED" }, _sum: { amount: true } }),
      prisma.session.findMany({
        where: { therapistId: therapist.id },
        orderBy: { date: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { user: { select: { name: true } } },
      }),
      prisma.session.count({ where: { therapistId: therapist.id } }),
    ]);

    return sendSuccess(res, "Earnings fetched", {
      totalEarnings: totalEarnings._sum.amount ?? 0,
      monthlyEarnings: monthEarnings._sum.amount ?? 0,
      pendingEarnings: pendingEarnings._sum.amount ?? 0,
      transactions: { items: transactions, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Failed to fetch earnings", 500);
  }
};

// GET /api/therapist-dashboard/profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const therapist = await prisma.therapist.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { name: true, avatar: true, email: true } } },
    });
    if (!therapist) return sendError(res, "Therapist profile not found", 404);
    return sendSuccess(res, "Profile fetched", therapist);
  } catch (err) {
    return sendError(res, "Failed to fetch profile", 500);
  }
};

export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  approach: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional(),
  specialty: z.array(z.string()).optional(),
  sessionTypes: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  available: z.boolean().optional(),
  introVideo: z.string().url().optional().nullable(),
});

// PATCH /api/therapist-dashboard/profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.therapist.update({
      where: { userId: req.user!.id },
      data: req.body,
    });
    return sendSuccess(res, "Profile updated", updated);
  } catch (err) {
    return sendError(res, "Failed to update profile", 500);
  }
};

// POST /api/therapist-dashboard/upload-image
export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) return sendError(res, "No file provided", 400);
    if (!isCloudinaryConfigured()) return sendError(res, "Image upload not configured. Add Cloudinary credentials to .env", 503);

    const therapist = await getTherapist(req.user!.id);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "mindspace/therapists", transformation: [{ width: 800, height: 600, crop: "fill" }] },
        (error, data) => { if (error || !data) reject(error); else resolve(data); }
      ).end(req.file!.buffer);
    });

    const updated = await prisma.therapist.update({
      where: { id: therapist.id },
      data: { images: { push: result.secure_url } },
    });

    // Set user avatar if not already set
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatar: true } });
    if (!user?.avatar) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { avatar: result.secure_url } });
    }

    return sendSuccess(res, "Image uploaded", { url: result.secure_url, images: updated.images });
  } catch {
    return sendError(res, "Failed to upload image", 500);
  }
};

// DELETE /api/therapist-dashboard/images
export const deleteImage = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const { url } = req.body as { url: string };
    if (!url) return sendError(res, "Image URL required", 400);

    const updated = await prisma.therapist.update({
      where: { id: therapist.id },
      data: { images: { set: therapist.images.filter((img: string) => img !== url) } },
    });

    return sendSuccess(res, "Image removed", { images: updated.images });
  } catch {
    return sendError(res, "Failed to delete image", 500);
  }
};

// PATCH /api/therapist-dashboard/appointments/:id/notes
export const updateSessionNotes = async (req: Request, res: Response) => {
  try {
    const therapist = await getTherapist(req.user!.id);
    const { id } = req.params;
    const { notes } = req.body as { notes: string };

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return sendError(res, "Session not found", 404);
    if (session.therapistId !== therapist.id) return sendError(res, "Forbidden", 403);

    const updated = await prisma.session.update({
      where: { id },
      data: { notes: notes?.trim() || null },
    });
    return sendSuccess(res, "Notes saved", updated);
  } catch (err) {
    return sendError(res, "Failed to save notes", 500);
  }
};
