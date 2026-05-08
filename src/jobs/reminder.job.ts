import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { queueEmail } from "./email.queue";
import { logger } from "../utils/logger";

// Runs every hour — sends reminders for sessions starting in 22–26 h window
export const initReminderJob = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

      const sessions = await prisma.session.findMany({
        where: {
          status: { in: ["CONFIRMED", "PENDING"] },
          date: { gte: windowStart, lte: windowEnd },
          reminderSent: false,
        },
        include: {
          user: { select: { name: true, email: true } },
          therapist: { include: { user: { select: { name: true, email: true } } } },
        },
      });

      for (const session of sessions) {
        const therapistName = session.therapist.user.name;
        const dateStr = session.date.toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        // Email to user
        if (session.user.email) {
          await queueEmail({
            to: session.user.email,
            toName: session.user.name,
            subject: `Reminder: Session with ${therapistName} Tomorrow`,
            templateType: "session_reminder",
            data: { therapistName, date: dateStr, duration: String(session.duration), type: session.type === "ONLINE" ? "Online" : "In-Person" },
          });
        }

        // Mark reminder sent
        await prisma.session.update({ where: { id: session.id }, data: { reminderSent: true } });
        logger.info(`⏰ Reminder sent for session ${session.id}`);
      }

      if (sessions.length > 0) logger.info(`⏰ Reminder job: sent ${sessions.length} reminders`);
    } catch (err) {
      logger.error("Reminder job error", err);
    }
  });

  logger.info("✅ Session reminder cron job started (runs every hour)");
};
