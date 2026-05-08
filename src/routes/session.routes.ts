import { Router } from "express";
import * as sessionController from "../controllers/session.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createSessionSchema } from "../controllers/session.controller";

const router = Router();

router.post("/", authenticate, validate(createSessionSchema), sessionController.createSession);
router.get("/", authenticate, sessionController.getUserSessions);
router.patch("/:id/cancel", authenticate, sessionController.cancelSession);

export default router;
