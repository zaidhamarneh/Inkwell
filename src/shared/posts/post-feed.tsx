"use client";

import { usePostFeed } from "@/shared/state/posts-context";
import { Button } from "@/shared/ui/button";

import { PostCard } from "./post-card";

type PostFeedProps = {
  /** "all": everyone's posts (dashboard). "mine": the user's own (feed). */
  scope: "all" | "mine";
  /** Shown when there are no posts at all. */
  empty: React.ReactNode;
};

/**
 * Post cards from PostsContext (usePostFeed), 20 at a time with a
 * "Load more" button. The first page is prefetched on the server, so it
 * renders immediately without a loading state.
 */
export function PostFeed({ scope, empty }: PostFeedProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    usePostFeed(scope);

  const posts = data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-4">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>

      {isFetchNextPageError && (
        <p role="alert" className="text-center text-sm text-destructive">
          Couldn&apos;t load more posts. Try again.
        </p>
      )}

      {hasNextPage && (
        <Button
          variant="outline"
          className="justify-self-center"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
