import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const isConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const wrapHtml = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 32px 16px; }
    .card { background: #fff; border-radius: 16px; max-width: 520px; margin: 0 auto; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo-icon { width: 36px; height: 36px; background: #7c3aed; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center; }
    .logo-name { font-size: 18px; font-weight: 700; color: #18181b; }
    h1 { font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
    p { font-size: 15px; color: #52525b; line-height: 1.6; margin: 0 0 12px; }
    .detail-box { background: #f4f4f5; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #71717a; }
    .detail-value { font-weight: 600; color: #18181b; }
    .btn { display: inline-block; background: #7c3aed; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">M</div>
      <span class="logo-name">MindSpace</span>
    </div>
    ${body}
    <div class="footer">© 2026 MindSpace. All rights reserved.<br/>This is an automated message — please do not reply.</div>
  </div>
</body>
</html>`;

const TEMPLATES: Record<string, (data: Record<string, string | number>, toName: string) => { subject: string; html: string }> = {
  session_booked: (data, toName) => ({
    subject: `Session Booked with ${data.therapistName}`,
    html: wrapHtml(`
      <h1>Session Booked! 📅</h1>
      <p>Hi ${toName}, your session has been successfully booked.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Therapist</span><span class="detail-value">${data.therapistName}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">${data.duration} minutes</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${data.type}</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">৳${data.amount}</span></div>
      </div>
      <p>Your session is pending confirmation. We'll notify you once confirmed.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/user/sessions" class="btn">View My Sessions</a>
    `),
  }),

  session_confirmed: (data, toName) => ({
    subject: `Session Confirmed with ${data.therapistName}`,
    html: wrapHtml(`
      <h1>Session Confirmed! ✅</h1>
      <p>Hi ${toName}, your session has been confirmed by your therapist.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Therapist</span><span class="detail-value">${data.therapistName}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">${data.duration} minutes</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${data.type}</span></div>
      </div>
      <p>Please be ready 5 minutes before your session.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/user/sessions" class="btn">View My Sessions</a>
    `),
  }),

  session_cancelled: (data, toName) => ({
    subject: `Session Cancelled — ${data.date}`,
    html: wrapHtml(`
      <h1>Session Cancelled</h1>
      <p>Hi ${toName}, your session with <strong>${data.therapistName}</strong> on ${data.date} has been cancelled.</p>
      <p>If you'd like to rebook, you can find another available slot on our platform.</p>
      <a href="${process.env.FRONTEND_URL}/therapists" class="btn">Find a Therapist</a>
    `),
  }),

  session_completed: (data, toName) => ({
    subject: `Session Completed — How was it?`,
    html: wrapHtml(`
      <h1>Session Completed 🎉</h1>
      <p>Hi ${toName}, your session with <strong>${data.therapistName}</strong> has been marked as completed.</p>
      <p>We hope it was valuable! Consider leaving a review to help others find the right therapist.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/user/sessions" class="btn">Leave a Review</a>
    `),
  }),

  session_reminder: (data, toName) => ({
    subject: `Reminder: Session with ${data.therapistName} Tomorrow`,
    html: wrapHtml(`
      <h1>Session Reminder ⏰</h1>
      <p>Hi ${toName}, just a reminder that you have a session coming up soon!</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Therapist</span><span class="detail-value">${data.therapistName}</span></div>
        <div class="detail-row"><span class="detail-label">Date & Time</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">${data.duration} minutes</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${data.type}</span></div>
      </div>
      <p>Please be ready 5 minutes early. If you need to cancel, please do so at least 2 hours before.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/user/sessions" class="btn">View Session</a>
    `),
  }),

  welcome: (_data, toName) => ({
    subject: `Welcome to MindSpace 🧠`,
    html: wrapHtml(`
      <h1>Welcome, ${toName}! 🧠</h1>
      <p>You've taken an important step toward better mental wellness. Here's what you can do:</p>
      <div class="detail-box">
        <p style="margin:6px 0">✅ Browse licensed therapists and book a session</p>
        <p style="margin:6px 0">📖 Write in your private mood journal</p>
        <p style="margin:6px 0">📊 Track your daily mood with emoji check-ins</p>
        <p style="margin:6px 0">🤖 Chat with Aria, your AI wellness companion</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/dashboard/user/overview" class="btn">Go to Dashboard</a>
    `),
  }),
};

export const sendEmail = async (
  to: string,
  toName: string,
  templateType: keyof typeof TEMPLATES,
  data: Record<string, string | number>
): Promise<void> => {
  if (!isConfigured()) {
    logger.warn(`📧 SMTP not configured — skipping email to ${to} (${templateType})`);
    return;
  }

  try {
    const { subject, html } = TEMPLATES[templateType](data, toName);
    await transporter.sendMail({
      from: `"MindSpace" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`📧 Email sent: "${subject}" → ${to}`);
  } catch (err) {
    logger.error(`📧 Email failed to ${to}`, err);
  }
};
