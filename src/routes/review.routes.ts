import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import * as c from "../controllers/review.controller";

const router = Router();
router.use(authenticate);
router.post("/", validate(c.createReviewSchema), c.createReview);
router.get("/check", c.checkReviewed);

export default router;
