import "server-only";

import { z } from "zod";

import { getPost, listPosts } from "@/shared/repositories/post-repository";

import { protectedProcedure, router } from "../init";

const idSchema = z.string().min(1).max(64);

export const postsRouter = router({
  /**
   * Newest posts first, a page at a time. `scope: "all"` is everyone's posts
   * (dashboard), `"mine"` is the signed-in user's own (feed). `cursor` is
   * filled in by useInfiniteQuery from the previous page's `nextCursor`.
   */
  list: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["all", "mine"]),
        cursor: idSchema.nullish(),
      }),
    )
    .query(({ ctx, input }) =>
      listPosts({
        viewerId: ctx.user.id,
        authorId: input.scope === "mine" ? ctx.user.id : undefined,
        cursor: input.cursor ?? undefined,
      }),
    ),

  /** One post with counts and liked-by-me, or null if it doesn't exist. */
  byId: protectedProcedure
    .input(z.object({ postId: idSchema }))
    .query(({ ctx, input }) => getPost(input.postId, ctx.user.id)),
});
