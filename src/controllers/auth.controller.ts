import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import * as authService from "../services/auth.service";

export const register = async (req: Request, res: Response) => {
  try {
    const result = await authService.registerUser(req.body);
    logger.info(`New user registered: ${req.body.email} (${req.body.role})`);
    return sendSuccess(res, "Account created successfully", result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return sendError(res, message, message.includes("already") ? 409 : 400);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    logger.info(`User logged in: ${email}`);
    return sendSuccess(res, "Login successful", result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return sendError(res, message, 401);
  }
};

export const oauthLogin = async (req: Request, res: Response) => {
  try {
    const result = await authService.oauthUser(req.body);
    logger.info(`OAuth login: ${req.body.email} via ${req.body.provider}`);
    return sendSuccess(res, "OAuth login successful", result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return sendError(res, message, 400);
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await authService.getMe(req.user!.id);
    return sendSuccess(res, "User fetched", user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch user";
    return sendError(res, message, 404);
  }
};
