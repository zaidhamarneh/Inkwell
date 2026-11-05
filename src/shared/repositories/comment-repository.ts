import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";

import type { CommentItem } from "./types";

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
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
    updatedAt: row.updatedAt,
    isMine: row.authorId === viewerId,
  };
}

/** Who wrote the comment and which post it's on, or null if it doesn't exist. */
export async function getCommentOwnership(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, postId: true },
  });
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
 * Replaces a comment's text. Call assertCommentAuthor() first; the authorId
 * filter is a second guard. Returns null if nothing matched.
 */
export async function updateComment(
  commentId: string,
  authorId: string,
  content: string,
): Promise<CommentItem | null> {
  const { count } = await prisma.comment.updateMany({
    where: { id: commentId, authorId },
    data: { content },
  });
  if (count === 0) return null;

  const row = await prisma.comment.findUnique({
    where: { id: commentId },
    select: commentSelect,
  });
  return row ? toItem(row, authorId) : null;
}

/**
 * Deletes a comment. Call assertCommentAuthor() first; the authorId filter
 * is a second guard. False if nothing matched.
 */
export async function deleteComment(commentId: string, authorId: string) {
  const { count } = await prisma.comment.deleteMany({
    where: { id: commentId, authorId },
  });
  return count > 0;
}
