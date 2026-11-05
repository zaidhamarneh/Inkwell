import Link from "next/link";
import { Suspense } from "react";

import { PrefetchedPostFeed } from "@/shared/posts/prefetched-post-feed";
import { PostFeedSkeleton } from "@/shared/posts/skeletons";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          The latest posts from everyone on Inkwell.
        </p>
      </header>

      <Suspense fallback={<PostFeedSkeleton />}>
        <PrefetchedPostFeed
          scope="all"
          empty={
            <>
              Nobody has posted yet.{" "}
              <Link href="/posts/new" className="font-medium text-foreground underline underline-offset-4">
                Write the first post
              </Link>
            </>
          }
        />
      </Suspense>
    </main>
  );
}
