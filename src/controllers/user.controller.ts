import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary";

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// GET /api/users/stats
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [upcoming, total, completed, moodLogs, allMoodLogs, notifications] = await Promise.all([
      prisma.session.count({ where: { userId, status: { in: ["PENDING", "CONFIRMED"] }, date: { gte: now } } }),
      prisma.session.count({ where: { userId } }),
      prisma.session.count({ where: { userId, status: "COMPLETED" } }),
      prisma.moodLog.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, orderBy: { createdAt: "asc" }, select: { score: true, createdAt: true } }),
      prisma.moodLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true }, take: 60 }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    // Calculate streak
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < allMoodLogs.length; i++) {
      const d = new Date(allMoodLogs[i].createdAt); d.setHours(0, 0, 0, 0);
      const expected = new Date(today); expected.setDate(today.getDate() - i);
      if (d.getTime() === expected.getTime()) streak++;
      else break;
    }

    const avgMood = moodLogs.length > 0
      ? Math.round((moodLogs.reduce((s, l) => s + l.score, 0) / moodLogs.length) * 10) / 10
      : 0;

    const moodTrend = moodLogs.map((l) => ({
      date: new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: l.score,
    }));

    // Upcoming sessions
    const upcomingSessions = await prisma.session.findMany({
      where: { userId, status: { in: ["PENDING", "CONFIRMED"] }, date: { gte: now } },
      take: 3,
      orderBy: { date: "asc" },
      include: { therapist: { include: { user: { select: { name: true, avatar: true } } } } },
    });

    // Session breakdown
    const [pending, confirmed, cancelled] = await Promise.all([
      prisma.session.count({ where: { userId, status: "PENDING" } }),
      prisma.session.count({ where: { userId, status: "CONFIRMED" } }),
      prisma.session.count({ where: { userId, status: "CANCELLED" } }),
    ]);

    return sendSuccess(res, "Stats fetched", {
      upcomingSessions: upcoming,
      totalSessions: total,
      completedSessions: completed,
      moodScore: avgMood,
      streakDays: streak,
      unreadNotifications: notifications,
      moodTrend,
      upcomingSessionsList: upcomingSessions,
      sessionBreakdown: [
        { name: "Completed", value: completed },
        { name: "Upcoming", value: pending + confirmed },
        { name: "Cancelled", value: cancelled },
      ],
    });
  } catch {
    return sendError(res, "Failed to fetch stats", 500);
  }
};

// PATCH /api/users/profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data: Record<string, unknown> = { ...req.body };
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth as string);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, bio: true, plan: true, dateOfBirth: true },
    });

    return sendSuccess(res, "Profile updated", user);
  } catch {
    return sendError(res, "Failed to update profile", 500);
  }
};

// PATCH /api/users/password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password) return sendError(res, "Password change not available for OAuth accounts", 400);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return sendError(res, "Current password is incorrect", 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return sendSuccess(res, "Password changed successfully");
  } catch {
    return sendError(res, "Failed to change password", 500);
  }
};

// GET /api/users/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return sendSuccess(res, "Notifications fetched", notifications);
  } catch {
    return sendError(res, "Failed to fetch notifications", 500);
  }
};

// POST /api/users/upload-avatar
export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    if (!req.file) return sendError(res, "No file provided", 400);
    if (!isCloudinaryConfigured()) return sendError(res, "Image upload not configured. Add Cloudinary credentials to .env", 503);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "mindspace/avatars", transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }] },
        (error, data) => { if (error || !data) reject(error); else resolve(data); }
      ).end(req.file!.buffer);
    });

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar: result.secure_url },
      select: { id: true, name: true, email: true, avatar: true },
    });

    return sendSuccess(res, "Avatar uploaded", user);
  } catch {
    return sendError(res, "Failed to upload avatar", 500);
  }
};

// PATCH /api/users/notifications/read
export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    return sendSuccess(res, "Notifications marked as read");
  } catch {
    return sendError(res, "Failed to mark notifications", 500);
  }
};
