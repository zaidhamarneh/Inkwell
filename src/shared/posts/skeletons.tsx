import { Skeleton } from "@/shared/ui/skeleton";

// Suspense fallbacks shaped like the content they stand in for, so the page
// doesn't jump when the real data streams in.

/** Same frame as PostCard: title, two excerpt lines, byline + actions row. */
export function PostCardSkeleton() {
  return (
    <div aria-hidden className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <Skeleton className="h-7 w-3/4" />
      <div className="mt-3 grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-10" />
        </div>
      </div>
    </div>
  );
}

export function PostFeedSkeleton() {
  return (
    <output className="grid gap-4" aria-label="Loading posts">
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </output>
  );
}

/** A post page while the post loads: title, byline, body, actions, comments. */
export function PostPageSkeleton() {
  return (
    <output className="grid gap-6" aria-label="Loading post">
      <div className="grid gap-4" aria-hidden>
        <Skeleton className="h-9 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <div className="grid gap-2" aria-hidden>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-12 w-full" aria-hidden />
      <div className="mt-4 grid gap-3" aria-hidden>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    </output>
  );
}

export function CommentListSkeleton() {
  return (
    <output className="grid gap-5" aria-label="Loading comments">
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2" aria-hidden>
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="ml-8 h-4 w-2/3" />
        </div>
      ))}
    </output>
  );
}

export function PostFormSkeleton() {
  return (
    <output className="grid gap-5" aria-label="Loading post">
      <div className="grid gap-2" aria-hidden>
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid gap-2" aria-hidden>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="flex justify-end gap-2" aria-hidden>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </output>
  );
}
