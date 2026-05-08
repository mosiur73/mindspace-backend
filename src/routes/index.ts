import { Router } from "express";
import authRoutes from "./auth.routes";
import statsRoutes from "./stats.routes";
import therapistRoutes from "./therapist.routes";
import sessionRoutes from "./session.routes";
import journalRoutes from "./journal.routes";
import moodRoutes from "./mood.routes";
import userRoutes from "./user.routes";
import therapistDashboardRoutes from "./therapist-dashboard.routes";
import adminRoutes from "./admin.routes";
import aiRoutes from "./ai.routes";
import subscriptionRoutes from "./subscription.routes";
import reviewRoutes from "./review.routes";
import newsletterRoutes from "./newsletter.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/stats", statsRoutes);
router.use("/therapists", therapistRoutes);
router.use("/sessions", sessionRoutes);
router.use("/journals", journalRoutes);
router.use("/moods", moodRoutes);
router.use("/users", userRoutes);
router.use("/therapist-dashboard", therapistDashboardRoutes);
router.use("/admin", adminRoutes);
router.use("/ai", aiRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/reviews", reviewRoutes);
router.use("/newsletter", newsletterRoutes);

export default router;
