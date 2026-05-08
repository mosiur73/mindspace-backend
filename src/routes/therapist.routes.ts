import { Router } from "express";
import * as therapistController from "../controllers/therapist.controller";
import { getAvailableSlots } from "../controllers/availability.controller";

const router = Router();

router.get("/", therapistController.getTherapists);
router.get("/specialties", therapistController.getSpecialties);
router.get("/:id", therapistController.getTherapist);
router.get("/:id/reviews", therapistController.getTherapistReviews);
router.get("/:id/related", therapistController.getRelatedTherapists);
router.get("/:id/slots", getAvailableSlots);

export default router;
