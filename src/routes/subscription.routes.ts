import { Router } from "express";
import * as c from "../controllers/subscription.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Authenticated routes
router.post("/initiate", authenticate, c.initiatePayment);
router.get("/status", authenticate, c.getSubscriptionStatus);

// SSLCommerz callback routes (no auth — SSLCommerz posts here)
router.post("/ipn/success", c.paymentSuccess);
router.post("/ipn/fail", c.paymentFail);
router.post("/ipn/cancel", c.paymentCancel);
router.post("/ipn", c.paymentIPN);

export default router;
