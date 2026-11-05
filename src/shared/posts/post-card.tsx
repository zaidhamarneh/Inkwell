import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";

import type { PostSummary } from "@/shared/repositories/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";

import { AuthorByline } from "./author-byline";
import { LikeButton } from "./like-button";

export function PostCard({ post }: { post: PostSummary }) {
  const href = `/posts/${post.id}`;

  return (
    <Card>
      <CardHeader className="gap-3">
        <AuthorByline author={post.author} date={post.createdAt} size="sm" />
        <h2 className="text-lg leading-snug font-semibold text-foreground">
          <Link
            href={href}
            className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {post.title}
          </Link>
        </h2>
      </CardHeader>

      {post.excerpt && (
        <CardContent>
          <p className="leading-relaxed text-muted-foreground">{post.excerpt}</p>
        </CardContent>
      )}

      <CardFooter className="gap-1 border-t py-2">
        <LikeButton
          postId={post.id}
          liked={post.likedByMe}
          likeCount={post.likeCount}
        />
        <Link
          href={`${href}#comments`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MessageCircleIcon aria-hidden className="size-4" />
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </Link>
      </CardFooter>
    </Card>
  );
}
