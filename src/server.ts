import "dotenv/config";
import http from "http";
import * as Sentry from "@sentry/node";
import app from "./app";
import { prisma } from "./lib/prisma";
import { logger } from "./utils/logger";
import { initEmailQueue, closeQueue } from "./jobs/email.queue";
import { initReminderJob } from "./jobs/reminder.job";
import { initSocket } from "./services/socket.service";
import { cache } from "./utils/cache";

const PORT = parseInt(process.env.PORT || "5000", 10);

// ── Sentry ─────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
  logger.info("✅ Sentry error tracking initialized");
} else {
  logger.warn("SENTRY_DSN not set — error tracking disabled");
}

// ── Server start ────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info("✅ Database connected");

    // Create HTTP server (required for Socket.io)
    const httpServer = http.createServer(app);

    // Initialize Socket.io
    initSocket(httpServer);

    // Initialize email queue
    initEmailQueue();

    // Initialize session reminder cron
    initReminderJob();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 MindSpace API running on http://localhost:${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV}`);
      logger.info(`   Cache entries: ${cache.stats().active} active`);
      logger.info(`   Socket.io: enabled`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully…");
  await closeQueue();
  await prisma.$disconnect();
  logger.info("Server shut down cleanly");
  process.exit(0);
});

startServer();
