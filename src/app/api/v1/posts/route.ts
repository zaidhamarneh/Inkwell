import {
  json,
  parseBody,
  requireApiSession,
  toApiPost,
  withErrorHandling,
} from "@/shared/api/http";
import { createPost } from "@/shared/repositories/post-repository";
import { postSchema } from "@/shared/schemas/post/post";

/**
 * POST /api/v1/posts
 * Body: { title, content }
 * 201 → { data: { post } }
 * 401 UNAUTHORIZED · 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 */
export const POST = withErrorHandling(async (request) => {
  const { user } = await requireApiSession(request);
  const input = await parseBody(request, postSchema);

  const post = await createPost(user.id, input);

  return json({ post: toApiPost(post) }, 201);
});
