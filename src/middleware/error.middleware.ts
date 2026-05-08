import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    statusCode,
    stack: err.stack,
  });

  // Capture unhandled 5xx errors in Sentry
  if (statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("route", `${req.method} ${req.path}`);
      scope.setUser({ id: (req as Request & { user?: { id: string } }).user?.id });
      Sentry.captureException(err);
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
