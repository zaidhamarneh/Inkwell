import { z } from "zod";

// Shared by the post forms (browser) and the post API (server).
// Creating and editing use the same schema: title and content are always sent.

export const POST_TITLE_MAX = 150;
export const POST_CONTENT_MAX = 20_000;

export const postSchema = z.object({
  title: z
    .string({ error: "Enter a title" })
    .trim()
    .min(1, "Enter a title")
    .max(POST_TITLE_MAX, `Title must be at most ${POST_TITLE_MAX} characters`),
  content: z
    .string({ error: "Write something" })
    .trim()
    .min(1, "Write something")
    .max(
      POST_CONTENT_MAX,
      `Post must be at most ${POST_CONTENT_MAX.toLocaleString("en")} characters`,
    ),
});

export type PostInput = z.infer<typeof postSchema>;
