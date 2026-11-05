"use server";

import { refresh } from "next/cache";

import { Errors } from "@/shared/api/errors";
import { assertCommentAuthor } from "@/shared/auth/ownership";
import {
  createComment,
  deleteComment as deleteCommentRow,
  updateComment,
} from "@/shared/repositories/comment-repository";
import type { CommentItem } from "@/shared/repositories/types";
import { commentSchema } from "@/shared/schemas/comment/comment";

import { idSchema, parseInput, requireActionUser, runAction } from "./run-action";
import type { ActionResult } from "./types";

export async function addComment(
  postId: string,
  input: { content: string },
): Promise<ActionResult<{ comment: CommentItem }>> {
  return runAction("addComment", async () => {
    const user = await requireActionUser();
    const id = parseInput(idSchema, postId);
    const { content } = parseInput(commentSchema, input);

    const comment = await createComment(id, user.id, content);
    if (!comment) throw Errors.notFound("This post no longer exists.");

    refresh();
    return { comment };
  });
}

/** Replaces a comment's text. Only its author may (403 otherwise). */
export async function editComment(
  commentId: string,
  input: { content: string },
): Promise<ActionResult<{ comment: CommentItem }>> {
  return runAction("editComment", async () => {
    const user = await requireActionUser();
    const id = parseInput(idSchema, commentId);
    await assertCommentAuthor(id, user.id);
    const { content } = parseInput(commentSchema, input);

    const comment = await updateComment(id, user.id, content);
    // Deleted between the check and the update.
    if (!comment) throw Errors.notFound("Comment not found.");

    refresh();
    return { comment };
  });
}

/** Deletes a comment. Only its author may (403 otherwise). */
export async function deleteComment(
  commentId: string,
): Promise<ActionResult<null>> {
  return runAction("deleteComment", async () => {
    const user = await requireActionUser();
    const id = parseInput(idSchema, commentId);
    await assertCommentAuthor(id, user.id);

    const deleted = await deleteCommentRow(id, user.id);
    if (!deleted) throw Errors.notFound("Comment not found.");

    refresh();
    return null;
  });
}
