"use server";

import { refresh } from "next/cache";

import { Errors } from "@/shared/api/errors";
import {
  createComment,
  deleteComment as deleteCommentRow,
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

export async function deleteComment(
  commentId: string,
): Promise<ActionResult<null>> {
  return runAction("deleteComment", async () => {
    const user = await requireActionUser();
    const id = parseInput(idSchema, commentId);

    // Only deletes the user's own comment; anything else looks like "not found".
    const postId = await deleteCommentRow(id, user.id);
    if (!postId) throw Errors.notFound("Comment not found.");

    refresh();
    return null;
  });
}
