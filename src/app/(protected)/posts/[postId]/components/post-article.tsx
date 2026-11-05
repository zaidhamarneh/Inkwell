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
    <article className="grid gap-8">
      <header className="grid gap-5 border-b pb-8">
        <h1 className="font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance wrap-break-word sm:text-5xl">
          {post.title}
        </h1>
        <AuthorByline
          author={post.author}
          date={post.createdAt}
          updatedAt={post.updatedAt}
          readingMinutes={post.readingMinutes}
        />
      </header>

      <div className="font-serif text-lg leading-8 wrap-break-word whitespace-pre-wrap text-foreground/90 sm:text-xl sm:leading-9">
        {post.content}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y py-3">
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
