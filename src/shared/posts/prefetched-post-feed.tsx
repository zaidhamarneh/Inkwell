import "server-only";

import { io } from "next/cache";

import { getQueryClient, HydrateClient, trpc } from "@/shared/trpc/server";

import { PostFeed } from "./post-feed";

type PrefetchedPostFeedProps = {
  scope: "all" | "mine";
  empty: React.ReactNode;
};

/**
 * Server half of a post list: starts loading the first page and hands it to
 * the client PostFeed. Render it inside <Suspense> (with PostFeedSkeleton):
 * everything here is request-time work, and keeping it below a boundary is
 * what lets navigations to the page show its heading instantly.
 */
export async function PrefetchedPostFeed({ scope, empty }: PrefetchedPostFeedProps) {
  // Request-time work follows (React Query reads the clock when it creates
  // the query); keep it out of the build-time prerender. Waits for no data.
  await io();

  // Not awaited: React Query streams the pending result to PostFeed, which
  // suspends into the surrounding boundary until it arrives. The data stays
  // in the React Query cache, so "Load more" and refetches keep working.
  void getQueryClient().prefetchInfiniteQuery(
    trpc.posts.list.infiniteQueryOptions(
      { scope },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  return (
    <HydrateClient>
      <PostFeed scope={scope} empty={empty} />
    </HydrateClient>
  );
}
