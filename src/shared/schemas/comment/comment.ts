import { z } from "zod";

// Shared by the comment form (browser) and the comment server action.

export const COMMENT_MAX = 2_000;

export const commentSchema = z.object({
  content: z
    .string({ error: "Write a comment" })
    .trim()
    .min(1, "Write a comment")
    .max(
      COMMENT_MAX,
      `Comment must be at most ${COMMENT_MAX.toLocaleString("en")} characters`,
    ),
});

export type CommentInput = z.infer<typeof commentSchema>;
