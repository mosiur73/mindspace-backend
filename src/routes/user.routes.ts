import { Router } from "express";
import * as c from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate);
router.get("/stats", c.getUserStats);
router.patch("/profile", validate(c.updateProfileSchema), c.updateProfile);
router.patch("/password", validate(c.changePasswordSchema), c.changePassword);
router.get("/notifications", c.getNotifications);
router.patch("/notifications/read", c.markNotificationsRead);
router.post("/upload-avatar", upload.single("avatar"), c.uploadAvatar);

export default router;
