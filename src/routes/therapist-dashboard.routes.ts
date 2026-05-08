import { Router } from "express";
import * as c from "../controllers/therapist-dashboard.controller";
import * as av from "../controllers/availability.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate, authorize("THERAPIST"));

router.get("/stats", c.getStats);
router.get("/appointments", c.getAppointments);
router.patch("/appointments/:id/status", c.updateAppointmentStatus);
router.patch("/appointments/:id/notes", c.updateSessionNotes);
router.get("/clients", c.getClients);
router.get("/earnings", c.getEarnings);
router.get("/profile", c.getProfile);
router.patch("/profile", validate(c.updateProfileSchema), c.updateProfile);
router.post("/upload-image", upload.single("image"), c.uploadImage);
router.delete("/images", c.deleteImage);
router.get("/availability", av.getAvailability);
router.put("/availability", validate(av.saveAvailabilitySchema), av.saveAvailability);

export default router;
