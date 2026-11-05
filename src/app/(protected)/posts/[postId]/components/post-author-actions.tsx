"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Edit and Delete, shown only to the post's author. */
export function PostAuthorActions({ postId }: { postId: string }) {
  const router = useRouter();
  const { deletePost } = usePosts();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(event: React.MouseEvent) {
    // Keep the dialog open until the request finishes, so errors show in it.
    event.preventDefault();
    setDeleting(true);
    setError(null);

    // PostsContext deletes it and refreshes the dashboard and feed.
    const result = await deletePost(postId);
    if (!result.ok) {
      setDeleting(false);
      setError(result.error.message);
      return;
    }

    router.replace("/feed");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" asChild>
        <Link href={`/posts/${postId}/edit`}>
          <PencilIcon aria-hidden data-icon="inline-start" />
          Edit
        </Link>
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (deleting) return;
          setOpen(next);
          setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2Icon aria-hidden data-icon="inline-start" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              Its comments and likes will be deleted too. This can&apos;t be undone.
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
              {deleting ? "Deleting…" : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
