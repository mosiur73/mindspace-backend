import { Response } from "express";

export const sendSuccess = (
  res: Response,
  message: string,
  data?: unknown,
  statusCode = 200
) => {
  return res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
) => {
  return res.status(statusCode).json({ success: false, message, errors });
};
