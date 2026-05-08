import { Router } from "express";
import * as c from "../controllers/mood.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { aiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(authenticate);
router.post("/", validate(c.createMoodSchema), c.logMood);
router.get("/", c.getMoodLogs);
router.get("/today", c.getTodayMood);
router.post("/analyze", aiLimiter, c.analyzeMoods);

export default router;
