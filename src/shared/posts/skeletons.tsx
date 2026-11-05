import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

// Suspense fallbacks shaped like the content they stand in for, so the page
// doesn't jump when the real data streams in.

export function PostCardSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent className="grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
      <CardFooter className="gap-3 border-t py-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </CardFooter>
    </Card>
  );
}

export function PostFeedSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading posts">
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  );
}

/** A post page while the post loads: title, byline, body, actions, comments. */
export function PostPageSkeleton() {
  return (
    <div className="grid gap-6" role="status" aria-label="Loading post">
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
    </div>
  );
}

export function CommentListSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading comments">
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2" aria-hidden>
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="ml-8 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function PostFormSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading post">
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
    </div>
  );
}
