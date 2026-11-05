"use client";

import { useState } from "react";

import { AuthorByline } from "@/shared/posts/author-byline";
import type { CommentItem as Comment } from "@/shared/repositories/types";
import { Button } from "@/shared/ui/button";

import { DeleteCommentButton } from "./delete-comment-button";
import { EditCommentForm } from "./edit-comment-form";
import {  Edit3  } from "lucide-react";

export function CommentItem({ comment }: { comment: Comment }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <AuthorByline
          author={comment.author}
          date={comment.createdAt}
          updatedAt={comment.updatedAt}
          size="sm"
        />
        {comment.isMine && !editing && (
          <span className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setEditing(true)}
              aria-label="Edit comment"
              title="Edit comment"
              className="text-muted-foreground"
            >
              <Edit3  className="h-4 w-4" />
            </Button>
            <DeleteCommentButton commentId={comment.id} />
          </span>
        )}
      </div>

      {editing ? (
        <EditCommentForm
          commentId={comment.id}
          content={comment.content}
          onDone={() => setEditing(false)}
        />
      ) : (
        <p className="pl-8 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
          {comment.content}
        </p>
      )}
    </li>
  );
}
