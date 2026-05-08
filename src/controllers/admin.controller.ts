import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { generateBlog } from "../services/ai.service";
import { emitNotification } from "../services/socket.service";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary";

// ── Platform Stats ─────────────────────────────────────────────────────────

export const getPlatformStats = async (_req: Request, res: Response) => {
  try {
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [totalUsers, totalTherapists, verifiedTherapists, totalSessions, completedSessions, revenue, activeSubscriptions, recentUsers, recentSessions, recentActivity] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.therapist.count(),
      prisma.therapist.count({ where: { verified: true } }),
      prisma.session.count(),
      prisma.session.count({ where: { status: "COMPLETED" } }),
      prisma.session.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.user.findMany({ where: { createdAt: { gte: twelveMonthsAgo } }, select: { createdAt: true } }),
      prisma.session.findMany({ where: { date: { gte: sixMonthsAgo } }, select: { date: true } }),
      prisma.session.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true, status: true, amount: true, createdAt: true,
          user: { select: { name: true } },
          therapist: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);

    const groupByMonth = (items: { createdAt?: Date; date?: Date }[]) => {
      const map: Record<string, number> = {};
      items.forEach(i => {
        const d = (i.createdAt ?? i.date)!;
        const key = new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        map[key] = (map[key] || 0) + 1;
      });
      return Object.entries(map).map(([month, count]) => ({ month, count }));
    };

    return sendSuccess(res, "Platform stats fetched", {
      totalUsers,
      totalTherapists,
      verifiedTherapists,
      totalSessions,
      completedSessions,
      totalRevenue: revenue._sum.amount ?? 0,
      activeSubscriptions,
      userGrowthChart: groupByMonth(recentUsers),
      sessionsChart: groupByMonth(recentSessions),
      recentActivity,
    });
  } catch { return sendError(res, "Failed to fetch stats", 500); }
};

// ── Users ──────────────────────────────────────────────────────────────────

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, role, plan, status, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(20, parseInt(limit, 10));

    const where: Record<string, unknown> = {
      ...(role && role !== "ALL" && { role }),
      ...(plan && plan !== "ALL" && { plan }),
      ...(status === "active" && { isActive: true }),
      ...(status === "banned" && { isActive: false }),
      ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * limitNum, take: limitNum, select: { id: true, name: true, email: true, role: true, plan: true, isActive: true, createdAt: true, avatar: true } }),
      prisma.user.count({ where }),
    ]);

    return sendSuccess(res, "Users fetched", { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch { return sendError(res, "Failed to fetch users", 500); }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (id === req.user!.id) return sendError(res, "Cannot ban yourself", 400);
    const user = await prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } });
    return sendSuccess(res, `User ${isActive ? "unbanned" : "banned"}`, user);
  } catch { return sendError(res, "Failed to update user status", 500); }
};

// ── Therapists ─────────────────────────────────────────────────────────────

export const getTherapists = async (req: Request, res: Response) => {
  try {
    const { verified, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10);

    const where = verified === "true" ? { verified: true } : verified === "false" ? { verified: false } : {};

    const [items, total] = await Promise.all([
      prisma.therapist.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * limitNum, take: limitNum, include: { user: { select: { name: true, avatar: true, email: true, isActive: true } } } }),
      prisma.therapist.count({ where }),
    ]);

    const withStats = await Promise.all(items.map(async t => {
      const sessions = await prisma.session.count({ where: { therapistId: t.id } });
      return { ...t, totalSessionsCount: sessions };
    }));

    return sendSuccess(res, "Therapists fetched", { items: withStats, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch { return sendError(res, "Failed to fetch therapists", 500); }
};

export const updateTherapistVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const therapist = await prisma.therapist.update({ where: { id }, data: { verified }, include: { user: { select: { name: true } } } });
    return sendSuccess(res, `Therapist ${verified ? "verified" : "rejected"}`, therapist);
  } catch { return sendError(res, "Failed to update therapist", 500); }
};

// ── Subscriptions ──────────────────────────────────────────────────────────

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const { plan, status, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10);

    const where = { ...(plan && plan !== "ALL" && { plan: plan as "FREE" | "PRO" | "PREMIUM" }), ...(status && status !== "ALL" && { status: status as "ACTIVE" | "EXPIRED" | "CANCELLED" }) };

    const [items, total, revenue] = await Promise.all([
      prisma.subscription.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * limitNum, take: limitNum, include: { user: { select: { name: true, email: true } } } }),
      prisma.subscription.count({ where }),
      prisma.subscription.aggregate({ where: { status: "ACTIVE" }, _sum: { amount: true } }),
    ]);

    return sendSuccess(res, "Subscriptions fetched", { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum), monthlyRevenue: revenue._sum.amount ?? 0 });
  } catch { return sendError(res, "Failed to fetch subscriptions", 500); }
};

// ── Blogs ──────────────────────────────────────────────────────────────────

export const createBlogSchema = z.object({
  title: z.string().min(5, "Title too short"),
  content: z.string().min(50, "Content too short"),
  excerpt: z.string().optional(),
  category: z.string().min(1, "Category required"),
  tags: z.array(z.string()).default([]),
  coverImage: z.string().url().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export const getBlogs = async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10);
    const where = status && status !== "ALL" ? { status: status as "DRAFT" | "PUBLISHED" } : {};

    const [items, total] = await Promise.all([
      prisma.blog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * limitNum, take: limitNum }),
      prisma.blog.count({ where }),
    ]);

    return sendSuccess(res, "Blogs fetched", { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch { return sendError(res, "Failed to fetch blogs", 500); }
};

export const createBlog = async (req: Request, res: Response) => {
  try {
    const blog = await prisma.blog.create({ data: { ...req.body, authorId: req.user!.id } });
    return sendSuccess(res, "Blog created", blog, 201);
  } catch { return sendError(res, "Failed to create blog", 500); }
};

export const updateBlog = async (req: Request, res: Response) => {
  try {
    const prevBlog = await prisma.blog.findUnique({ where: { id: req.params.id }, select: { status: true } });
    const blog = await prisma.blog.update({ where: { id: req.params.id }, data: req.body });

    // Send notification to all users when blog is newly published
    const justPublished = prevBlog?.status === "DRAFT" && blog.status === "PUBLISHED";
    if (justPublished) {
      const users = await prisma.user.findMany({
        where: { role: "USER" },
        select: { id: true },
        take: 200,
      });

      const notif = {
        title: "New Article Published",
        message: `New article: "${blog.title}" — check it out on the blog.`,
        type: "system",
      };

      await prisma.notification.createMany({
        data: users.map((u) => ({ userId: u.id, ...notif })),
        skipDuplicates: true,
      });

      // Real-time push to online users
      users.forEach((u) => emitNotification(u.id, notif));
    }

    return sendSuccess(res, "Blog updated", blog);
  } catch { return sendError(res, "Failed to update blog", 500); }
};

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    await prisma.blog.delete({ where: { id: req.params.id } });
    return sendSuccess(res, "Blog deleted");
  } catch { return sendError(res, "Failed to delete blog", 500); }
};

export const generateBlogContent = async (req: Request, res: Response) => {
  try {
    const { topic, category } = req.body;
    if (!topic || !category) return sendError(res, "Topic and category are required", 400);
    const content = await generateBlog(topic, category);
    return sendSuccess(res, "Blog content generated", content);
  } catch { return sendError(res, "Failed to generate blog", 500); }
};

// POST /admin/blogs/upload-cover
export const uploadBlogCover = async (req: Request, res: Response) => {
  try {
    if (!req.file) return sendError(res, "No file provided", 400);
    if (!isCloudinaryConfigured()) return sendError(res, "Image upload not configured. Add Cloudinary credentials to .env", 503);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "mindspace/blog-covers", transformation: [{ width: 1200, height: 630, crop: "fill" }] },
        (error, data) => { if (error || !data) reject(error); else resolve(data); }
      ).end(req.file!.buffer);
    });

    return sendSuccess(res, "Cover uploaded", { url: result.secure_url });
  } catch {
    return sendError(res, "Failed to upload cover image", 500);
  }
};

// ── Public Blogs ───────────────────────────────────────────────────────────

export const getPublicBlogs = async (req: Request, res: Response) => {
  try {
    const { category, page = "1", limit = "9" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10);
    const where = { status: "PUBLISHED" as const, ...(category && category !== "All" && { category }) };

    const [items, total] = await Promise.all([
      prisma.blog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pageNum - 1) * limitNum, take: limitNum }),
      prisma.blog.count({ where }),
    ]);

    return sendSuccess(res, "Blogs fetched", { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch { return sendError(res, "Failed to fetch blogs", 500); }
};
