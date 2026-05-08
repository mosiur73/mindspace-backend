import { Router } from "express";
import * as c from "../controllers/journal.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { aiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(authenticate);
router.post("/", validate(c.createJournalSchema), c.createJournal);
router.get("/", c.getJournals);
router.get("/:id", c.getJournal);
router.patch("/:id", validate(c.updateJournalSchema), c.updateJournal);
router.delete("/:id", c.deleteJournal);
router.post("/:id/analyze", aiLimiter, c.analyzeJournalEntry);

export default router;
