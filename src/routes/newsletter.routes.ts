import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as c from "../controllers/newsletter.controller";

const router = Router();

router.post("/subscribe", validate(c.subscribeSchema), c.subscribe);
router.get("/", authenticate, authorize("ADMIN"), c.getSubscribers);

export default router;
