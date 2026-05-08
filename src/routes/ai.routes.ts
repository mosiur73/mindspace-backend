import { Router } from "express";
import * as c from "../controllers/ai.controller";
import { authenticate } from "../middleware/auth.middleware";
import { aiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(authenticate);

router.get("/chat", c.getChatHistory);
router.post("/chat", aiLimiter, c.sendMessage);
router.delete("/chat", c.clearChatHistory);
router.post("/recommend", aiLimiter, c.getTherapistRecommendations);

export default router;
