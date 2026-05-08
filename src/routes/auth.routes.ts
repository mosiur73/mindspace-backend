import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";
import { registerSchema, loginSchema, oauthSchema } from "../services/auth.service";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/oauth", validate(oauthSchema), authController.oauthLogin);
router.get("/me", authenticate, authController.getMe);

export default router;
