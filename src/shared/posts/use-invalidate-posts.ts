"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/shared/trpc/client";

/**
 * Marks every cached tRPC post query (lists and single posts) as stale, so
 * the next render fetches fresh data. Call after creating, editing or
 * deleting a post through the REST API.
 */
export function useInvalidatePosts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries(trpc.posts.pathFilter()),
    [queryClient, trpc],
  );
}
