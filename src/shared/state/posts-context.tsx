"use client";

import {
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createContext, use, useMemo } from "react";

import { callAction } from "@/shared/actions/call-action";
import {
  addComment,
  deleteComment,
  editComment,
} from "@/shared/actions/comment-actions";
import { setPostLike } from "@/shared/actions/like-actions";
import type { ActionResult } from "@/shared/actions/types";
import { apiDelete, apiPost, apiPut, type ApiResult } from "@/shared/api/client";
import type { PostResponse } from "@/shared/api/types";
import type { CommentItem } from "@/shared/repositories/types";
import type { CommentInput } from "@/shared/schemas/comment/comment";
import type { PostInput } from "@/shared/schemas/post/post";
import { useTRPC } from "@/shared/trpc/client";

/**
 * Blog post state for signed-in pages (Context API).
 *
 * Components never call tRPC, the REST client or server actions directly;
 * they go through this context:
 *   - reading:  usePostFeed(scope), usePost(postId)
 *   - changing: usePosts().createPost / updatePost / deletePost / setLike /
 *               addComment / editComment / deleteComment
 *
 * The context also owns cache consistency: after every change it refreshes
 * the affected post data, so the dashboard, feed and post page stay in sync.
 * Fetched data itself is cached by React Query underneath; the server still
 * enforces sign-in, ownership and rate limits on every change.
 */

type PostResult = ApiResult<PostResponse["data"]>;
type CommentResult = ActionResult<{ comment: CommentItem }>;

type PostsContextValue = {
  createPost: (input: PostInput) => Promise<PostResult>;
  updatePost: (postId: string, input: PostInput) => Promise<PostResult>;
  deletePost: (postId: string) => Promise<ApiResult<undefined>>;
  setLike: (
    postId: string,
    liked: boolean,
  ) => Promise<ActionResult<{ liked: boolean; likeCount: number }>>;
  addComment: (postId: string, input: CommentInput) => Promise<CommentResult>;
  editComment: (commentId: string, input: CommentInput) => Promise<CommentResult>;
  deleteComment: (commentId: string) => Promise<ActionResult<null>>;
};

const PostsContext = createContext<PostsContextValue | null>(null);

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const value = useMemo<PostsContextValue>(() => {
    // Refetch everything about posts (lists and single posts).
    const refreshAll = () => queryClient.invalidateQueries(trpc.posts.pathFilter());
    // Refetch only the lists (e.g. comment counts on the cards).
    const refreshLists = () =>
      queryClient.invalidateQueries(trpc.posts.list.pathFilter());

    return {
      async createPost(input) {
        const result = await apiPost<PostResponse["data"]>("/posts", input);
        if (result.ok) await refreshAll();
        return result;
      },
      async updatePost(postId, input) {
        const result = await apiPut<PostResponse["data"]>(`/posts/${postId}`, input);
        if (result.ok) await refreshAll();
        return result;
      },
      async deletePost(postId) {
        const result = await apiDelete(`/posts/${postId}`);
        // Lists only: refetching the deleted post itself would briefly show
        // "This post was deleted" before the caller navigates away.
        if (result.ok) void refreshLists();
        return result;
      },
      async setLike(postId, liked) {
        const result = await callAction(() => setPostLike(postId, liked));
        // Awaited so callers keep their optimistic UI until fresh data lands.
        if (result.ok) await refreshAll();
        return result;
      },
      async addComment(postId, input) {
        // The action refreshes the post page (comment list) on the server.
        const result = await callAction(() => addComment(postId, input));
        if (result.ok) void refreshLists();
        return result;
      },
      async editComment(commentId, input) {
        return callAction(() => editComment(commentId, input));
      },
      async deleteComment(commentId) {
        const result = await callAction(() => deleteComment(commentId));
        if (result.ok) void refreshLists();
        return result;
      },
    };
  }, [queryClient, trpc]);

  return <PostsContext value={value}>{children}</PostsContext>;
}

/** Actions that change post data. Must be used under PostsProvider. */
export function usePosts(): PostsContextValue {
  const value = use(PostsContext);
  if (!value) throw new Error("usePosts must be used within <PostsProvider>");
  return value;
}

/**
 * A paginated post list: "all" (dashboard) or "mine" (feed). Suspends until
 * the first page is ready (prefetched on the server).
 */
export function usePostFeed(scope: "all" | "mine") {
  usePosts(); // post data is only available under PostsProvider
  const trpc = useTRPC();
  return useSuspenseInfiniteQuery(
    trpc.posts.list.infiniteQueryOptions(
      { scope },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
}

/** One post (or null if it doesn't exist). Suspends until it's loaded. */
export function usePost(postId: string) {
  usePosts();
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.posts.byId.queryOptions({ postId })).data;
}
