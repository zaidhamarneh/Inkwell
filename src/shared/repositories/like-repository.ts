import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";

export type SetLikeResult =
  | { status: "ok"; liked: boolean; likeCount: number }
  | { status: "not_found" }

/**
 * Sets whether `userId` likes `postId`. Takes the desired state rather than
 * toggling, so a double click or a retried request can't flip it twice.
 */
export async function setLike(
  postId: string,
  userId: string,
  liked: boolean,
): Promise<SetLikeResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) return { status: "not_found" };

  if (liked) {
    try {
      await prisma.like.create({ data: { postId, userId } });
    } catch (error) {
      const alreadyLiked =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      // P2003: the post was deleted between the check and the insert.
      const postGone =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003";
      if (postGone) return { status: "not_found" };
      if (!alreadyLiked) throw error;
    }
  } else {
    await prisma.like.deleteMany({ where: { postId, userId } });
  }

  const likeCount = await prisma.like.count({ where: { postId } });
  return { status: "ok", liked, likeCount };
}
