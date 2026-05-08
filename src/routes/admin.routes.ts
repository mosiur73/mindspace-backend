import { Router } from "express";
import * as c from "../controllers/admin.controller";
import * as ex from "../controllers/export.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { aiLimiter } from "../middleware/rateLimit.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

// Public
router.get("/blogs/public", c.getPublicBlogs);

// Admin only
router.use(authenticate, authorize("ADMIN"));

router.get("/stats", c.getPlatformStats);

router.get("/users", c.getUsers);
router.patch("/users/:id/status", c.updateUserStatus);

router.get("/therapists", c.getTherapists);
router.patch("/therapists/:id/verify", c.updateTherapistVerification);

router.get("/subscriptions", c.getSubscriptions);

router.get("/blogs", c.getBlogs);
router.post("/blogs", validate(c.createBlogSchema), c.createBlog);
router.patch("/blogs/:id", c.updateBlog);
router.delete("/blogs/:id", c.deleteBlog);
router.post("/blogs/generate", aiLimiter, c.generateBlogContent);
router.post("/blogs/upload-cover", upload.single("cover"), c.uploadBlogCover);

// CSV Export
router.get("/export/users", ex.exportUsers);
router.get("/export/sessions", ex.exportSessions);
router.get("/export/revenue", ex.exportRevenue);
router.get("/export/therapists", ex.exportTherapists);

export default router;
