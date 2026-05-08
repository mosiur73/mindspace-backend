import { Queue, Worker, Job } from "bullmq";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";

export interface EmailJobData {
  to: string;
  toName: string;
  subject: string;
  templateType: "session_booked" | "session_confirmed" | "session_cancelled" | "session_completed" | "welcome" | "session_reminder";
  data: Record<string, string | number>;
}

let emailQueue: Queue<EmailJobData> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;

// ── Email Templates ────────────────────────────────────────────────────────

const renderTemplate = (job: EmailJobData): string => {
  const { templateType, data, toName } = job;

  const templates: Record<string, string> = {
    session_booked: `
Hi ${toName},

Your session with ${data.therapistName} has been booked!

📅 Date: ${data.date}
⏱ Duration: ${data.duration} minutes
💻 Type: ${data.type}
💰 Amount: $${data.amount}

Your session is currently PENDING confirmation. We'll notify you when it's confirmed.

Best,
The MindSpace Team
    `.trim(),

    session_confirmed: `
Hi ${toName},

Great news! Your session with ${data.therapistName} has been CONFIRMED.

📅 Date: ${data.date}
⏱ Duration: ${data.duration} minutes
💻 Type: ${data.type}

Please be ready 5 minutes early. You can manage your sessions in your dashboard.

Best,
The MindSpace Team
    `.trim(),

    session_cancelled: `
Hi ${toName},

Your session with ${data.therapistName} on ${data.date} has been cancelled.

If you have any concerns, please contact our support team.

Best,
The MindSpace Team
    `.trim(),

    session_completed: `
Hi ${toName},

Your session with ${data.therapistName} has been marked as completed.

We hope your session was valuable! Consider booking your next session to continue your wellness journey.

Best,
The MindSpace Team
    `.trim(),

    welcome: `
Hi ${toName},

Welcome to MindSpace! 🧠

You've taken an important step toward better mental wellness. Here's what you can do:

✅ Browse our licensed therapists at /therapists
✅ Log your daily mood in your dashboard
✅ Write in your private journal
✅ Chat with our AI wellness companion, Aria

Best,
The MindSpace Team
    `.trim(),
  };

  return templates[templateType] ?? `Hi ${toName}, you have a new notification from MindSpace.`;
};

// ── Queue Processor ────────────────────────────────────────────────────────

const processEmailJob = async (job: Job<EmailJobData>) => {
  const { to, toName, templateType, data } = job.data;
  logger.info(`📧 [Email Queue] Processing "${templateType}" → ${to}`);
  await sendEmail(to, toName, templateType, data);
};

// ── Queue Init ─────────────────────────────────────────────────────────────

export const initEmailQueue = (): void => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn("REDIS_URL not set — BullMQ email queue disabled. Emails will be processed synchronously.");
    return;
  }

  try {
    const connection = { url: redisUrl };

    emailQueue = new Queue<EmailJobData>("mindspace-emails", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    emailWorker = new Worker<EmailJobData>("mindspace-emails", processEmailJob, {
      connection,
      concurrency: 5,
    });

    emailWorker.on("completed", (job) => logger.info(`✅ Email job ${job.id} completed`));
    emailWorker.on("failed", (job, err) => logger.error(`❌ Email job ${job?.id} failed`, err));

    logger.info("✅ BullMQ email queue initialized with Redis");
  } catch (err) {
    logger.error("Failed to initialize BullMQ — emails will be processed synchronously", err);
  }
};

// ── Public API ─────────────────────────────────────────────────────────────

export const queueEmail = async (data: EmailJobData): Promise<void> => {
  if (!emailQueue) {
    // Synchronous fallback when Redis is not available
    await processEmailJob({ data } as Job<EmailJobData>);
    return;
  }

  try {
    await emailQueue.add(data.templateType, data, { priority: 1 });
    logger.debug(`Email queued for ${data.to}: ${data.subject}`);
  } catch (err) {
    logger.error("Failed to queue email, falling back to sync", err);
    await processEmailJob({ data } as Job<EmailJobData>);
  }
};

export const getQueueStats = async () => {
  if (!emailQueue) return { status: "disabled", reason: "REDIS_URL not configured" };
  const [waiting, active, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);
  return { status: "active", waiting, active, completed, failed };
};

export const closeQueue = async (): Promise<void> => {
  if (emailWorker) await emailWorker.close();
  if (emailQueue) await emailQueue.close();
};
