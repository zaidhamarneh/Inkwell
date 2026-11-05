"use client";

import { use } from "react";

import type { CommentItem as Comment } from "@/shared/repositories/types";

import { CommentItem } from "./comment-item";

type CommentsProps = {
  /** Started (not awaited) by the page on the server; resolved here with use(). */
  commentsPromise: Promise<Comment[]>;
};

/** "(3)" next to the Comments heading. Shares the list's promise, so no extra query. */
export function CommentCount({ commentsPromise }: CommentsProps) {
  const comments = use(commentsPromise);
  return <span className="text-muted-foreground">({comments.length})</span>;
}

export function CommentList({ commentsPromise }: CommentsProps) {
  const comments = use(commentsPromise);

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No comments yet. Be the first to say something.
      </p>
    );
  }

  return (
    <ul className="grid gap-5">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}
