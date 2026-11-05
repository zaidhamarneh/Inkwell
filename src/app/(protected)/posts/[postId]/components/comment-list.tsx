"use client";

import { use } from "react";

import { AuthorByline } from "@/shared/posts/author-byline";
import type { CommentItem } from "@/shared/repositories/types";

import { DeleteCommentButton } from "./delete-comment-button";

type CommentsProps = {
  /** Started (not awaited) by the page on the server; resolved here with use(). */
  commentsPromise: Promise<CommentItem[]>;
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
        <li key={comment.id} className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <AuthorByline author={comment.author} date={comment.createdAt} size="sm" />
            {comment.isMine && <DeleteCommentButton commentId={comment.id} />}
          </div>
          <p className="pl-8 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {comment.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
