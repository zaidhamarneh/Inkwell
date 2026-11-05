import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";

import type { PostSummary } from "@/shared/repositories/types";

import { AuthorByline } from "./author-byline";
import { LikeButton } from "./like-button";

/**
 * A post in a list. The whole card opens the post: the title link is
 * stretched over the card with an ::after overlay, so keyboard users still
 * get one clear link (the title). The like and comment controls sit above
 * the overlay (relative z-10) so they stay separately clickable.
 */
export function PostCard({ post }: { post: PostSummary }) {
  const href = `/posts/${post.id}`;

  return (
    <article className="group/post relative rounded-xl border bg-card p-5 shadow-xs transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-within:border-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6 dark:hover:shadow-black/30">
      {/* Ink rule on the left edge, drawn in on hover/focus. */}
      <span
        aria-hidden
        className="absolute inset-y-6 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-primary transition-transform duration-200 group-focus-within/post:scale-y-100 group-hover/post:scale-y-100 motion-reduce:transition-none"
      />

      <h2 className="font-serif text-xl leading-snug font-semibold tracking-tight text-balance wrap-break-word sm:text-2xl">
        <Link
          href={href}
          className="outline-none transition-colors group-hover/post:text-primary after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {post.title}
        </Link>
      </h2>

      {post.excerpt && (
        <p className="mt-2 line-clamp-2 leading-relaxed text-muted-foreground wrap-break-word">
          {post.excerpt}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Not interactive: clicks fall through to the stretched link. */}
        <div className="pointer-events-none min-w-0">
          <AuthorByline
            author={post.author}
            date={post.createdAt}
            readingMinutes={post.readingMinutes}
            size="sm"
          />
        </div>

        <div className="relative z-10 -mr-2 flex items-center gap-0.5">
          <LikeButton
            postId={post.id}
            liked={post.likedByMe}
            likeCount={post.likeCount}
            compact
          />
          <Link
            href={`${href}#comments`}
            aria-label={`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground tabular-nums transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MessageCircleIcon aria-hidden className="size-4" />
            {post.commentCount}
          </Link>
        </div>
      </div>
    </article>
  );
}
