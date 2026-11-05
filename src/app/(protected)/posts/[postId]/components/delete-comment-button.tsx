"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { deleteComment } from "@/shared/actions/comment-actions";
import { callAction } from "@/shared/actions/call-action";
import { useTRPC } from "@/shared/trpc/client";
import { Button } from "@/shared/ui/button";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      // On success the action refreshes the page and this comment disappears.
      const result = await callAction(() => deleteComment(commentId));
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Comment counts on post cards come from tRPC.
      void queryClient.invalidateQueries(trpc.posts.list.pathFilter());
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="xs"
        onClick={onDelete}
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </span>
  );
}
