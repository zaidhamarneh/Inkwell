"use client";

import { Trash } from "lucide-react";
import { useState } from "react";

import { usePosts } from "@/shared/state/posts-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

/** Trash icon that asks for confirmation before deleting your comment. */
export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const { deleteComment } = usePosts();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(event: React.MouseEvent) {
    // Keep the dialog open until the request finishes, so errors show in it.
    event.preventDefault();
    setDeleting(true);
    setError(null);

    // The server checks you wrote the comment; on success it refreshes the
    // page and the comment disappears.
    const result = await deleteComment(commentId);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setOpen(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (deleting) return;
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label="Delete comment"
          title="Delete comment"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash aria-hidden className="h-4 w-4 text-red-700" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete comment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
