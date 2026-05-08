import { Request, Response } from "express";
import SSLCommerzPayment from "sslcommerz-lts";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { logger } from "../utils/logger";

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID || "testbox";
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD || "qwerty";
const IS_LIVE = process.env.SSLCOMMERZ_IS_LIVE === "true";

const PLAN_CONFIG = {
  PRO: { amount: 2900, label: "MindSpace Pro — Monthly", months: 1 },
  PREMIUM: { amount: 7900, label: "MindSpace Premium — Monthly", months: 1 },
};

// POST /api/subscriptions/initiate
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { plan } = req.body as { plan: "PRO" | "PREMIUM" };

    if (!PLAN_CONFIG[plan]) return sendError(res, "Invalid plan", 400);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });
    if (!user) return sendError(res, "User not found", 404);

    const config = PLAN_CONFIG[plan];
    const tranId = `MS-${userId.slice(-6)}-${Date.now()}`;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const data = {
      total_amount: config.amount,
      currency: "BDT",
      tran_id: tranId,
      success_url: `${backendUrl}/api/subscriptions/ipn/success`,
      fail_url: `${frontendUrl}/payment/fail`,
      cancel_url: `${frontendUrl}/payment/cancel`,
      ipn_url: `${backendUrl}/api/subscriptions/ipn`,
      shipping_method: "No",
      product_name: config.label,
      product_category: "Software",
      product_profile: "non-physical-goods",
      cus_name: user.name,
      cus_email: user.email,
      cus_add1: "Dhaka",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: user.phone || "01700000000",
      ship_name: user.name,
      ship_add1: "N/A",
      ship_city: "Dhaka",
      ship_country: "Bangladesh",
      ship_postcode: "1000",
      value_a: userId,
      value_b: plan,
    };

    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, IS_LIVE);
    const apiResponse = await sslcz.init(data);

    if (!apiResponse?.GatewayPageURL) {
      logger.error("SSLCommerz init failed", apiResponse);
      return sendError(res, "Payment gateway error", 502);
    }

    logger.info(`Payment initiated: ${tranId} | user=${userId} | plan=${plan}`);
    return sendSuccess(res, "Payment initiated", { url: apiResponse.GatewayPageURL });
  } catch (err) {
    logger.error("initiatePayment error", err);
    return sendError(res, "Failed to initiate payment", 500);
  }
};

// POST /api/subscriptions/ipn/success  (SSLCommerz redirects user here)
export const paymentSuccess = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  try {
    const { val_id, tran_id, value_a: userId, value_b: plan, card_type } = req.body as Record<string, string>;

    // Validate with SSLCommerz
    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, IS_LIVE);
    const validation = await sslcz.validate({ val_id }) as Record<string, string>;

    if (validation.status !== "VALID" && validation.status !== "VALIDATED") {
      logger.warn(`Invalid SSLCommerz validation: ${val_id}`);
      return res.redirect(`${frontendUrl}/payment/fail?reason=invalid`);
    }

    const config = PLAN_CONFIG[plan as "PRO" | "PREMIUM"];
    if (!config || !userId) {
      return res.redirect(`${frontendUrl}/payment/fail?reason=invalid`);
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + config.months);

    // Upsert subscription
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: plan as "PRO" | "PREMIUM",
        startDate: now,
        endDate,
        status: "ACTIVE",
        amount: config.amount,
        transactionId: tran_id,
        paymentMethod: card_type || "SSLCommerz",
      },
      update: {
        plan: plan as "PRO" | "PREMIUM",
        startDate: now,
        endDate,
        status: "ACTIVE",
        amount: config.amount,
        transactionId: tran_id,
        paymentMethod: card_type || "SSLCommerz",
      },
    });

    // Update user plan
    await prisma.user.update({
      where: { id: userId },
      data: { plan: plan as "PRO" | "PREMIUM" },
    });

    // Send welcome notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Subscription Activated!",
        message: `Your ${plan} plan is now active. Enjoy all premium features!`,
        type: "system",
      },
    });

    logger.info(`Subscription activated: userId=${userId} plan=${plan} tran=${tran_id}`);
    return res.redirect(`${frontendUrl}/payment/success?plan=${plan}&tran=${tran_id}`);
  } catch (err) {
    logger.error("paymentSuccess error", err);
    return res.redirect(`${frontendUrl}/payment/fail?reason=error`);
  }
};

// POST /api/subscriptions/ipn/fail
export const paymentFail = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  logger.warn("Payment failed", req.body);
  return res.redirect(`${frontendUrl}/payment/fail`);
};

// POST /api/subscriptions/ipn/cancel
export const paymentCancel = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  logger.info("Payment cancelled", req.body);
  return res.redirect(`${frontendUrl}/payment/cancel`);
};

// POST /api/subscriptions/ipn  (server-to-server IPN)
export const paymentIPN = async (req: Request, res: Response) => {
  logger.info("SSLCommerz IPN received", req.body);
  return res.status(200).send("OK");
};

// GET /api/subscriptions/status
export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });
    return sendSuccess(res, "Subscription fetched", subscription);
  } catch {
    return sendError(res, "Failed to fetch subscription", 500);
  }
};
