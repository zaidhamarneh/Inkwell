import { z } from "zod";

// Shared by the browser (form validation) and the server (Server Actions).
// Keep this folder free of server-only imports such as Prisma or auth.

export const NAME_MAX = 100;
// The longest address SMTP allows (RFC 5321).
export const EMAIL_MAX = 254;

const email = z
  .email("Enter a valid email")
  .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`);

// Matches Better Auth's default password length limits.
const password = z
  .string({ error: "Enter a password" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "Enter your password" })
    .min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Enter your name" })
      .trim()
      .min(1, "Enter your name")
      .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`),
    email,
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
