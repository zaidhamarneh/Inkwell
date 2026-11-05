import { Errors } from "@/shared/api/errors";
import {
  json,
  noContent,
  parseBody,
  requireApiSession,
  toApiPost,
  withErrorHandling,
} from "@/shared/api/http";
import { assertPostAuthor } from "@/shared/auth/ownership";
import { deletePost, updatePost } from "@/shared/repositories/post-repository";
import { postSchema } from "@/shared/schemas/post/post";

type Context = RouteContext<"/api/v1/posts/[postId]">;

/**
 * PUT /api/v1/posts/:postId
 * Body: { title, content } (both required; replaces the post)
 * 200 → { data: { post } }
 * 401 UNAUTHORIZED · 403 FORBIDDEN (not your post) · 404 NOT_FOUND
 * 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 */
export const PUT = withErrorHandling<Context>(async (request, { params }) => {
  const { user } = await requireApiSession(request);
  const { postId } = await params;

  // Ownership first, so a non-author gets 403 whatever they send.
  await assertPostAuthor(postId, user.id);
  const input = await parseBody(request, postSchema);

  const post = await updatePost(postId, user.id, input);
  // Deleted between the check and the update.
  if (!post) throw Errors.notFound("Post not found.");

  return json({ post: toApiPost(post) });
});

/**
 * DELETE /api/v1/posts/:postId
 * 204 → deleted, along with its comments and likes.
 * 401 UNAUTHORIZED · 403 FORBIDDEN (not your post) · 404 NOT_FOUND
 */
export const DELETE = withErrorHandling<Context>(async (request, { params }) => {
  const { user } = await requireApiSession(request);
  const { postId } = await params;

  await assertPostAuthor(postId, user.id);

  const deleted = await deletePost(postId, user.id);
  if (!deleted) throw Errors.notFound("Post not found.");

  return noContent();
});
