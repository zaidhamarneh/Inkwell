import { Errors } from "@/shared/api/errors";
import {
  json,
  noContent,
  parseBody,
  requireApiSession,
  toApiPost,
  withErrorHandling,
} from "@/shared/api/http";
import { deletePost, updatePost } from "@/shared/repositories/post-repository";
import { postSchema } from "@/shared/schemas/post/post";

type Context = RouteContext<"/api/v1/posts/[postId]">;

// "Not found" covers both a missing post and someone else's post, so the API
// never reveals whether a post it won't let you change exists.
const notFound = () => Errors.notFound("Post not found.");

/**
 * PUT /api/v1/posts/:postId
 * Body: { title, content } (both required; replaces the post)
 * 200 → { data: { post } }
 * 401 UNAUTHORIZED · 404 NOT_FOUND · 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 */
export const PUT = withErrorHandling<Context>(async (request, { params }) => {
  const { user } = await requireApiSession(request);
  const { postId } = await params;
  const input = await parseBody(request, postSchema);

  const post = await updatePost(postId, user.id, input);
  if (!post) throw notFound();

  return json({ post: toApiPost(post) });
});

/**
 * DELETE /api/v1/posts/:postId
 * 204 → deleted, along with its comments and likes.
 * 401 UNAUTHORIZED · 404 NOT_FOUND
 */
export const DELETE = withErrorHandling<Context>(async (request, { params }) => {
  const { user } = await requireApiSession(request);
  const { postId } = await params;

  const deleted = await deletePost(postId, user.id);
  if (!deleted) throw notFound();

  return noContent();
});
