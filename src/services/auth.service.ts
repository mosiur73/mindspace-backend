import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { Role } from "@prisma/client";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["USER", "THERAPIST"]).default("USER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const oauthSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().optional().nullable(),
  provider: z.string(),
});

type RegisterInput = z.infer<typeof registerSchema>;
type OAuthInput = z.infer<typeof oauthSchema>;

const sanitizeUser = (user: { id: string; name: string; email: string; role: Role; avatar: string | null; plan: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  plan: user.plan,
});

export const registerUser = async (data: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Email already registered");

  const hashed = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      role: data.role as Role,
    },
  });

  if (data.role === "THERAPIST") {
    await prisma.therapist.create({
      data: { userId: user.id, price: 0 },
    });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), token };
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) throw new Error("Invalid email or password");
  if (!user.isActive) throw new Error("Account is deactivated");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid email or password");

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), token };
};

export const oauthUser = async (data: OAuthInput) => {
  let user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        avatar: data.avatar,
        emailVerified: new Date(),
        accounts: {
          create: {
            type: "oauth",
            provider: data.provider,
            providerAccountId: data.email,
          },
        },
      },
    });
  }

  if (!user.isActive) throw new Error("Account is deactivated");

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      phone: true,
      bio: true,
      plan: true,
      dateOfBirth: true,
      createdAt: true,
      therapist: {
        select: {
          id: true,
          specialty: true,
          verified: true,
          rating: true,
          price: true,
        },
      },
    },
  });

  if (!user) throw new Error("User not found");
  return user;
};
