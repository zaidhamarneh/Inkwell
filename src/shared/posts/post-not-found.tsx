import Link from "next/link";

/** Shown when a post doesn't exist, was deleted, or isn't yours to edit. */
export function PostNotFound() {
  return (
    <div className="grid gap-3 py-6 text-center">
      <h2 className="text-2xl font-semibold">Post not found</h2>
      <p className="text-sm text-muted-foreground">
        It may have been deleted, or the link is wrong.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline underline-offset-4">
        Back to the dashboard
      </Link>
    </div>
  );
}
