"use client";

import Link from "next/link";

import { AuthorByline } from "@/shared/posts/author-byline";
import { LikeButton } from "@/shared/posts/like-button";
import { usePost } from "@/shared/state/posts-context";

import { PostAuthorActions } from "./post-author-actions";

export function PostArticle({ postId }: { postId: string }) {
  // From PostsContext; prefetched on the server, so it renders immediately.
  const post = usePost(postId);

  if (!post) {
    return (
      <p className="text-sm text-muted-foreground">
        This post was deleted.{" "}
        <Link href="/dashboard" className="font-medium text-foreground underline underline-offset-4">
          Back to the dashboard
        </Link>
      </p>
    );
  }

  return (
    <article className="grid gap-6">
      <header className="grid gap-4">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight wrap-break-word">
          {post.title}
        </h1>
        <AuthorByline author={post.author} date={post.createdAt} updatedAt={post.updatedAt} />
      </header>

      <div className="text-base leading-relaxed wrap-break-word whitespace-pre-wrap">
        {post.content}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y py-2">
        <LikeButton
          postId={post.id}
          liked={post.likedByMe}
          likeCount={post.likeCount}
        />
        {post.isMine && <PostAuthorActions postId={post.id} />}
      </div>
    </article>
  );
}
