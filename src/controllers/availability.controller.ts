import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";

export const saveAvailabilitySchema = z.object({
  slots: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotDuration: z.number().int().min(15).max(120).default(50),
    })
  ),
});

// GET /api/therapist-dashboard/availability
export const getAvailability = async (req: Request, res: Response) => {
  try {
    const therapist = await prisma.therapist.findUnique({ where: { userId: req.user!.id } });
    if (!therapist) return sendError(res, "Therapist not found", 404);
    const slots = await prisma.therapistAvailability.findMany({ where: { therapistId: therapist.id }, orderBy: { dayOfWeek: "asc" } });
    return sendSuccess(res, "Availability fetched", slots);
  } catch {
    return sendError(res, "Failed to fetch availability", 500);
  }
};

// PUT /api/therapist-dashboard/availability
export const saveAvailability = async (req: Request, res: Response) => {
  try {
    const therapist = await prisma.therapist.findUnique({ where: { userId: req.user!.id } });
    if (!therapist) return sendError(res, "Therapist not found", 404);
    const { slots } = req.body as z.infer<typeof saveAvailabilitySchema>;

    // Delete all and reinsert
    await prisma.therapistAvailability.deleteMany({ where: { therapistId: therapist.id } });
    if (slots.length > 0) {
      await prisma.therapistAvailability.createMany({
        data: slots.map((s) => ({ ...s, therapistId: therapist.id })),
      });
    }

    const updated = await prisma.therapistAvailability.findMany({ where: { therapistId: therapist.id }, orderBy: { dayOfWeek: "asc" } });
    return sendSuccess(res, "Availability saved", updated);
  } catch {
    return sendError(res, "Failed to save availability", 500);
  }
};

// GET /api/therapists/:id/slots?date=2026-05-15
export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.query as { date: string };
    if (!date) return sendError(res, "date query param required", 400);

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return sendError(res, "Invalid date", 400);
    const dayOfWeek = targetDate.getDay(); // 0=Sun

    // Get therapist availability for this day
    const availability = await prisma.therapistAvailability.findUnique({
      where: { therapistId_dayOfWeek: { therapistId: id, dayOfWeek } },
    });
    if (!availability) return sendSuccess(res, "No availability", []);

    // Generate slots
    const slots = generateTimeSlots(availability.startTime, availability.endTime, availability.slotDuration);

    // Find already booked sessions on this date
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const booked = await prisma.session.findMany({
      where: { therapistId: id, date: { gte: startOfDay, lte: endOfDay }, status: { in: ["PENDING", "CONFIRMED"] } },
      select: { date: true },
    });

    const bookedTimes = booked.map((s) => `${s.date.getHours().toString().padStart(2, "0")}:${s.date.getMinutes().toString().padStart(2, "0")}`);
    const available = slots.filter((s) => !bookedTimes.includes(s));

    return sendSuccess(res, "Slots fetched", { slots: available, bookedSlots: bookedTimes, slotDuration: availability.slotDuration });
  } catch {
    return sendError(res, "Failed to fetch slots", 500);
  }
};

function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + duration <= endMin) {
    const h = Math.floor(cur / 60).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    cur += duration;
  }
  return slots;
}
