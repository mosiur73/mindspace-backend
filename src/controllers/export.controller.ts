import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

const toCSV = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const str = val == null ? "" : String(val).replace(/"/g, '""');
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
};

const sendCSV = (res: Response, filename: string, csv: string) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
};

// GET /api/admin/export/users
export const exportUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = users.map((u) => ({
      ID: u.id,
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Plan: u.plan,
      "Joined Date": u.createdAt.toISOString().split("T")[0],
    }));
    sendCSV(res, `mindspace-users-${Date.now()}.csv`, toCSV(rows));
  } catch (err) {
    logger.error("Export users error", err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};

// GET /api/admin/export/sessions
export const exportSessions = async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        user: { select: { name: true, email: true } },
        therapist: { include: { user: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
    });
    const rows = sessions.map((s) => ({
      ID: s.id,
      "Client Name": s.user.name,
      "Client Email": s.user.email,
      "Therapist": s.therapist.user.name,
      Date: s.date.toISOString().split("T")[0],
      Time: s.date.toTimeString().slice(0, 5),
      Type: s.type,
      Duration: s.duration,
      Amount: s.amount,
      Status: s.status,
      "Created At": s.createdAt.toISOString().split("T")[0],
    }));
    sendCSV(res, `mindspace-sessions-${Date.now()}.csv`, toCSV(rows));
  } catch (err) {
    logger.error("Export sessions error", err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};

// GET /api/admin/export/revenue
export const exportRevenue = async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { status: "COMPLETED" },
      include: { therapist: { include: { user: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    });

    // Group by month
    const monthMap: Record<string, { month: string; sessions: number; revenue: number }> = {};
    for (const s of sessions) {
      const key = s.date.toISOString().slice(0, 7); // "2026-05"
      if (!monthMap[key]) monthMap[key] = { month: key, sessions: 0, revenue: 0 };
      monthMap[key].sessions += 1;
      monthMap[key].revenue += s.amount;
    }

    const rows = Object.values(monthMap)
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((m) => ({
        Month: m.month,
        "Completed Sessions": m.sessions,
        "Revenue (BDT)": m.revenue.toFixed(2),
      }));

    sendCSV(res, `mindspace-revenue-${Date.now()}.csv`, toCSV(rows));
  } catch (err) {
    logger.error("Export revenue error", err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};

// GET /api/admin/export/therapists
export const exportTherapists = async (_req: Request, res: Response) => {
  try {
    const therapists = await prisma.therapist.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    const rows = therapists.map((t) => ({
      ID: t.id,
      Name: t.user.name,
      Email: t.user.email,
      Specialties: t.specialty.join("; "),
      Experience: t.experience,
      Rating: t.rating,
      "Total Reviews": t.totalReviews,
      Price: t.price,
      Verified: t.verified ? "Yes" : "No",
      Available: t.available ? "Yes" : "No",
      "Joined Date": t.createdAt.toISOString().split("T")[0],
    }));
    sendCSV(res, `mindspace-therapists-${Date.now()}.csv`, toCSV(rows));
  } catch (err) {
    logger.error("Export therapists error", err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};
