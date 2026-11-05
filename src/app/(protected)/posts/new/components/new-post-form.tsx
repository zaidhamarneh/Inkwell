"use client";

import { useRouter } from "next/navigation";

import { apiPost } from "@/shared/api/client";
import type { PostResponse } from "@/shared/api/types";
import { PostForm } from "@/shared/posts/post-form";
import { useInvalidatePosts } from "@/shared/posts/use-invalidate-posts";

export function NewPostForm() {
  const router = useRouter();
  const invalidatePosts = useInvalidatePosts();

  return (
    <PostForm
      submitLabel="Publish"
      pendingLabel="Publishing…"
      cancelHref="/feed"
      onSubmit={async (values) => {
        const result = await apiPost<PostResponse["data"]>("/posts", values);
        if (!result.ok) return result.error;

        await invalidatePosts();
        router.push(`/posts/${result.data.post.id}`);
        router.refresh();
        return null;
      }}
    />
  );
}
