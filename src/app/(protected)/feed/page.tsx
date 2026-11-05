import Link from "next/link";
import { Suspense } from "react";

import { PrefetchedPostFeed } from "@/shared/posts/prefetched-post-feed";
import { PostFeedSkeleton } from "@/shared/posts/skeletons";

export default function FeedPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">My feed</h1>
        <p className="text-sm text-muted-foreground">Everything you&apos;ve posted.</p>
      </header>

      <Suspense fallback={<PostFeedSkeleton />}>
        <PrefetchedPostFeed
          scope="mine"
          empty={
            <>
              You haven&apos;t posted anything yet.{" "}
              <Link href="/posts/new" className="font-medium text-foreground underline underline-offset-4">
                Write your first post
              </Link>
            </>
          }
        />
      </Suspense>
    </main>
  );
}
