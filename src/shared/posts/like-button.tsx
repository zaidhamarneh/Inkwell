"use client";

import { cn } from "cn";
import { HeartIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { usePosts } from "@/shared/state/posts-context";

/** Clicks closer together than this are merged into one request. */
const SEND_DELAY_MS = 400;

type LikeButtonProps = {
  postId: string;
  liked: boolean;
  likeCount: number;
  /** Show only the number (e.g. in post cards); the accessible label stays full. */
  compact?: boolean;
};

/**
 * Like/unlike with client-side click limiting:
 * - each click updates the heart and count immediately;
 * - the request is only sent once clicking pauses for SEND_DELAY_MS, with
 *   the final state (10 rapid clicks → 1 request, or none if you end where
 *   you started);
 * - at most one request is in flight; a change made meanwhile is sent after.
 * The server also rate-limits likes per user (see like-actions.ts); if that
 * rejects a request, the button reverts and shows the message.
 */
export function LikeButton({ postId, liked, likeCount, compact = false }: LikeButtonProps) {
  // PostsContext saves the like and refreshes post data everywhere.
  const { setLike } = usePosts();

  // The state the user clicked to and the server hasn't confirmed yet
  // (null = nothing pending, show the server's values).
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wantRef = useRef<boolean | null>(null);
  const serverLikedRef = useRef(liked);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    serverLikedRef.current = liked;
  }, [liked]);

  // Leaving the page with an unsent click: send it anyway (fire and forget).
  useEffect(() => {
    return () => {
      if (timerRef.current === null) return;
      clearTimeout(timerRef.current);
      const want = wantRef.current;
      if (want !== null && want !== serverLikedRef.current) {
        void setLike(postId, want);
      }
    };
  }, [postId, setLike]);

  const shownLiked = pending ?? liked;
  const shownCount =
    likeCount + (pending === null || pending === liked ? 0 : pending ? 1 : -1);
  const label = `${shownCount} ${shownCount === 1 ? "like" : "likes"}`;

  async function send() {
    timerRef.current = null;
    // A request is already running; it re-checks when it finishes.
    if (sendingRef.current) return;

    const want = wantRef.current;
    if (want === null) return;
    if (want === serverLikedRef.current) {
      // Clicked back to where we started: nothing to send.
      wantRef.current = null;
      setPending(null);
      return;
    }

    sendingRef.current = true;
    // Resolves after the refreshed post data has arrived, so dropping the
    // pending state below doesn't flicker back to the old count.
    const result = await setLike(postId, want);

    if (!result.ok) {
      sendingRef.current = false;
      wantRef.current = null;
      setPending(null); // revert to the server's values
      setError(result.error.message);
      return;
    }

    serverLikedRef.current = result.data.liked;
    sendingRef.current = false;

    if (wantRef.current === want) {
      wantRef.current = null;
      setPending(null);
    } else if (wantRef.current !== null && timerRef.current === null) {
      // The user changed their mind while this request was running.
      void send();
    }
  }

  function onClick() {
    const next = !shownLiked;
    wantRef.current = next;
    setPending(next);
    setError(null);

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void send(), SEND_DELAY_MS);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={shownLiked}
        aria-label={shownLiked ? `Unlike (${label})` : `Like (${label})`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          shownLiked
            ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            : "text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400",
        )}
      >
        <HeartIcon
          aria-hidden
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            shownLiked && "scale-110 fill-current",
          )}
        />
        {compact ? shownCount : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
