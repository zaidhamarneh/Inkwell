import Link from "next/link";

/** Shown when someone opens the edit page of a post they didn't write. */
export function NotYourPost({ postId }: { postId: string }) {
  return (
    <div className="grid gap-3 py-6 text-center">
      <h2 className="font-serif text-3xl font-semibold tracking-tight">You can&apos;t edit this post</h2>
      <p className="text-sm text-muted-foreground">
        Only its author can edit or delete it.
      </p>
      <Link href={`/posts/${postId}`} className="text-sm font-medium underline underline-offset-4">
        Back to the post
      </Link>
    </div>
  );
}

/** Shown when a post doesn't exist or was deleted. */
export function PostNotFound() {
  return (
    <div className="grid gap-3 py-6 text-center">
      <h2 className="font-serif text-3xl font-semibold tracking-tight">Post not found</h2>
      <p className="text-sm text-muted-foreground">
        It may have been deleted, or the link is wrong.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline underline-offset-4">
        Back to the dashboard
      </Link>
    </div>
  );
}
