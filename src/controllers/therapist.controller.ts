import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { withCache, cache, TTL } from "../utils/cache";

const THERAPIST_SELECT = {
  id: true,
  specialty: true,
  bio: true,
  approach: true,
  price: true,
  sessionTypes: true,
  languages: true,
  experience: true,
  rating: true,
  totalReviews: true,
  verified: true,
  available: true,
  certifications: true,
  education: true,
  images: true,
  introVideo: true,
  user: { select: { id: true, name: true, avatar: true } },
};

// GET /api/therapists
export const getTherapists = async (req: Request, res: Response) => {
  try {
    const {
      search,
      specialty,
      minPrice,
      maxPrice,
      rating,
      language,
      availability,
      sort = "rating",
      page = "1",
      limit = "9",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.TherapistWhereInput = {
      verified: true,
      ...(specialty && { specialty: { has: specialty } }),
      ...(minPrice && { price: { gte: parseFloat(minPrice) } }),
      ...(maxPrice && { price: { lte: parseFloat(maxPrice) } }),
      ...(rating && { rating: { gte: parseFloat(rating) } }),
      ...(language && { languages: { has: language } }),
      ...(availability && { sessionTypes: { has: availability } }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { bio: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const orderBy: Prisma.TherapistOrderByWithRelationInput =
      sort === "price_asc"   ? { price: "asc" }
      : sort === "price_desc" ? { price: "desc" }
      : sort === "experience" ? { experience: "desc" }
      : { rating: "desc" };

    // Cache key includes all filter params
    const cacheKey = `therapists:${JSON.stringify({ specialty, minPrice, maxPrice, rating, language, availability, sort, pageNum, limitNum, search })}`;

    const result = await withCache(cacheKey, search ? 30 : TTL.THERAPIST_LIST, async () => {
      const [items, total] = await Promise.all([
        prisma.therapist.findMany({ where, orderBy, skip, take: limitNum, select: THERAPIST_SELECT }),
        prisma.therapist.count({ where }),
      ]);
      return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
    });

    return sendSuccess(res, "Therapists fetched", result);
  } catch {
    return sendError(res, "Failed to fetch therapists", 500);
  }
};

// GET /api/therapists/specialties
export const getSpecialties = async (_req: Request, res: Response) => {
  try {
    const unique = await withCache("therapists:specialties", TTL.SPECIALTIES, async () => {
      const therapists = await prisma.therapist.findMany({ where: { verified: true }, select: { specialty: true } });
      const all = therapists.flatMap((t) => t.specialty);
      return [...new Set(all)].sort();
    });
    return sendSuccess(res, "Specialties fetched", unique);
  } catch {
    return sendError(res, "Failed to fetch specialties", 500);
  }
};

// GET /api/therapists/:id
export const getTherapist = async (req: Request, res: Response) => {
  try {
    const therapist = await withCache(`therapist:${req.params.id}`, TTL.THERAPIST_DETAIL, async () => {
      const t = await prisma.therapist.findUnique({ where: { id: req.params.id }, select: THERAPIST_SELECT });
      return t;
    });
    if (!therapist) return sendError(res, "Therapist not found", 404);
    return sendSuccess(res, "Therapist fetched", therapist);
  } catch {
    return sendError(res, "Failed to fetch therapist", 500);
  }
};

// GET /api/therapists/:id/reviews
export const getTherapistReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(10, parseInt((req.query.limit as string) || "5", 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where: { therapistId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { name: true, avatar: true } } },
      }),
      prisma.review.count({ where: { therapistId: id } }),
    ]);

    return sendSuccess(res, "Reviews fetched", {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return sendError(res, "Failed to fetch reviews", 500);
  }
};

// GET /api/therapists/:id/related
export const getRelatedTherapists = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const current = await prisma.therapist.findUnique({
      where: { id },
      select: { specialty: true },
    });
    if (!current) return sendError(res, "Not found", 404);

    const related = await prisma.therapist.findMany({
      where: { id: { not: id }, verified: true, specialty: { hasSome: current.specialty } },
      take: 4,
      orderBy: { rating: "desc" },
      select: THERAPIST_SELECT,
    });

    return sendSuccess(res, "Related therapists fetched", related);
  } catch {
    return sendError(res, "Failed to fetch related therapists", 500);
  }
};
