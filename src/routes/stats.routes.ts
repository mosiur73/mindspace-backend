import { Router } from "express";
import { getPublicStats, getFeaturedTherapists } from "../controllers/stats.controller";

const router = Router();

router.get("/", getPublicStats);
router.get("/therapists/featured", getFeaturedTherapists);

export default router;
