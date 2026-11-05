"use client";

import { useRouter } from "next/navigation";
import { use } from "react";

import { apiPut } from "@/shared/api/client";
import type { PostResponse } from "@/shared/api/types";
import { PostForm } from "@/shared/posts/post-form";
import { PostNotFound } from "@/shared/posts/post-not-found";
import { useInvalidatePosts } from "@/shared/posts/use-invalidate-posts";
import type { PostInput } from "@/shared/schemas/post/post";

type EditPostFormProps = {
  postId: string;
  /**
   * Started (not awaited) by the page on the server. Resolves to the post's
   * title and content, or null if it doesn't exist or isn't the user's.
   */
  postPromise: Promise<(PostInput & { id: string }) | null>;
};

export function EditPostForm({ postId, postPromise }: EditPostFormProps) {
  const router = useRouter();
  const invalidatePosts = useInvalidatePosts();
  const post = use(postPromise);
  const postHref = `/posts/${postId}`;

  if (!post) return <PostNotFound />;

  return (
    <PostForm
      defaultValues={{ title: post.title, content: post.content }}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      cancelHref={postHref}
      onSubmit={async (values) => {
        const result = await apiPut<PostResponse["data"]>(
          `/posts/${postId}`,
          values,
        );
        if (!result.ok) return result.error;

        await invalidatePosts();
        router.push(postHref);
        router.refresh();
        return null;
      }}
    />
  );
}
