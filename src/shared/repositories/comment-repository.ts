import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";

import type { CommentItem } from "./types";

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  authorId: true,
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

function toItem(row: CommentRow, viewerId: string): CommentItem {
  return {
    id: row.id,
    content: row.content,
    author: row.author,
    createdAt: row.createdAt,
    isMine: row.authorId === viewerId,
  };
}

/** Comments on a post, oldest first. */
export async function listComments(
  postId: string,
  viewerId: string,
): Promise<CommentItem[]> {
  const rows = await prisma.comment.findMany({
    where: { postId },
    select: commentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => toItem(row, viewerId));
}

/** Adds a comment. Returns null if the post doesn't exist (e.g. just deleted). */
export async function createComment(
  postId: string,
  authorId: string,
  content: string,
): Promise<CommentItem | null> {
  try {
    const row = await prisma.comment.create({
      data: { postId, authorId, content },
      select: commentSelect,
    });
    return toItem(row, authorId);
  } catch (error) {
    // P2003: foreign key failed, i.e. the post is gone.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Deletes a comment if `authorId` wrote it. Returns the post id it was on
 * (to refresh that page), or null if it doesn't exist or isn't theirs.
 */
export async function deleteComment(commentId: string, authorId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, authorId },
    select: { postId: true },
  });
  if (!comment) return null;

  await prisma.comment.deleteMany({ where: { id: commentId, authorId } });
  return comment.postId;
}
