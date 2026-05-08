import express from "express";
import cors from "cors";
import helmet from "helmet";
import { globalLimiter } from "./middleware/rateLimit.middleware";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { logger } from "./utils/logger";
import routes from "./routes";

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiting
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "MindSpace API is running", timestamp: new Date() });
});
app.get("/", (_req, res) => {
  res.json({ success: true, message: "Welcome to MindSpace API Home" });
});

// API routes
app.use("/api", routes);

// 404 + Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
