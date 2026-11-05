import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { getServerSession } from "@/shared/auth/session";

import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

/** One query client per request, shared by everything rendered for it. */
export const getQueryClient = cache(makeQueryClient);

/**
 * tRPC for Server Components: calls procedures directly (no HTTP) and puts
 * the results in the request's query client, e.g.
 *   await getQueryClient().prefetchInfiniteQuery(trpc.posts.list.infiniteQueryOptions(...))
 */
export const trpc = createTRPCOptionsProxy({
  ctx: async () => ({ session: await getServerSession() }),
  router: appRouter,
  queryClient: getQueryClient,
});

/** Sends everything prefetched on the server to the browser's query cache. */
export function HydrateClient({ children }: { children: React.ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}
