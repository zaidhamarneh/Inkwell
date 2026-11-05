import "server-only";

import { Errors } from "@/shared/api/errors";
import { getCommentOwnership } from "@/shared/repositories/comment-repository";
import { getPostAuthorId } from "@/shared/repositories/post-repository";


export type Ownership = "owner" | "not_found" | "forbidden";

export function checkOwnership(authorId: string | null, userId: string): Ownership {
  if (authorId === null) return "not_found";
  return authorId === userId ? "owner" : "forbidden";
}

/** Throws 404/403 unless `userId` wrote the post. */
export async function assertPostAuthor(postId: string, userId: string) {
  const ownership = checkOwnership(await getPostAuthorId(postId), userId);
  if (ownership === "not_found") throw Errors.notFound("Post not found.");
  if (ownership === "forbidden") {
    throw Errors.forbidden("You can only edit or delete your own posts.");
  }
}

/** Throws 404/403 unless `userId` wrote the comment. Returns its post id. */
export async function assertCommentAuthor(commentId: string, userId: string) {
  const comment = await getCommentOwnership(commentId);
  const ownership = checkOwnership(comment?.authorId ?? null, userId);
  if (!comment || ownership === "not_found") {
    throw Errors.notFound("Comment not found.");
  }
  if (ownership === "forbidden") {
    throw Errors.forbidden("You can only edit or delete your own comments.");
  }
  return { postId: comment.postId };
}
