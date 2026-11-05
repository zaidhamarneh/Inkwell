import { z } from "zod";

// Shared by the browser (form validation) and the server (Server Actions).
// Keep this folder free of server-only imports such as Prisma or auth.

// Matches Better Auth's default password length limits.
const password = z
  .string({ error: "Enter a password" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z
    .string({ error: "Enter your password" })
    .min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    name: z.string({ error: "Enter your name" }).trim().min(1, "Enter your name"),
    email: z.email("Enter a valid email"),
    password,
    confirmPassword: z
      .string({ error: "Confirm your password" })
      .min(1, "Confirm your password"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (confirmPassword && password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
