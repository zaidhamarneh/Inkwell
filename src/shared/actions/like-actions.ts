"use server";

import { z } from "zod";

import { Errors } from "@/shared/api/errors";
import { consumeRateLimit, type RateLimitRule } from "@/shared/rate-limit/rate-limit";
import { setLike } from "@/shared/repositories/like-repository";

import { idSchema, parseInput, requireActionUser, runAction } from "./run-action";
import type { ActionResult } from "./types";

/**
 * Like/unlike changes allowed per user, across all posts. The like button
 * already merges rapid clicks into one request, so real use stays far below
 * this; it stops scripts and auto-clickers from hammering the database.
 */
const LIKE_RATE_LIMIT: RateLimitRule = { limit: 20, windowSeconds: 60 };

/**
 * Likes or unlikes a post. `liked` is the state the user wants, not a
 * toggle, so repeated clicks or retries always end in the right state.
 */
export async function setPostLike(
  postId: string,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return runAction("setPostLike", async () => {
    const user = await requireActionUser();
    const id = parseInput(idSchema, postId);
    const wantLiked = parseInput(z.boolean(), liked);

    // Checked on the server, so it applies however the request is made.
    const rate = await consumeRateLimit(`like:${user.id}`, LIKE_RATE_LIMIT);
    if (!rate.allowed) {
      throw Errors.rateLimited(
        `You're liking too fast. Try again in ${rate.retryAfterSeconds}s.`,
      );
    }

    const result = await setLike(id, user.id, wantLiked);
    if (result.status === "not_found") {
      throw Errors.notFound("This post no longer exists.");
    }

    // No refresh(): like counts are shown from tRPC queries, which the
    // like button invalidates in the browser after this returns.
    return { liked: result.liked, likeCount: result.likeCount };
  });
}
