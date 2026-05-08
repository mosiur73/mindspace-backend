import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { verifyToken } from "../utils/jwt";
import { logger } from "../utils/logger";

let io: SocketServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = verifyToken(token) as { id: string };
      socket.data.userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    logger.debug(`Socket connected: userId=${userId} socketId=${socket.id}`);

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnected: userId=${userId}`);
    });
  });

  logger.info("✅ Socket.io initialized");
  return io;
};

// Emit a notification to a specific user
export const emitNotification = (userId: string, notification: {
  title: string;
  message: string;
  type: string;
}) => {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification", {
    ...notification,
    createdAt: new Date().toISOString(),
  });
  logger.debug(`Socket notification → user:${userId} [${notification.type}]`);
};

export const getIO = () => io;
