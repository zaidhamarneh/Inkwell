"use client";

import { useRouter } from "next/navigation";

import { PostForm } from "@/shared/posts/post-form";
import { usePosts } from "@/shared/state/posts-context";

export function NewPostForm() {
  const router = useRouter();
  const { createPost } = usePosts();

  return (
    <PostForm
      submitLabel="Publish"
      pendingLabel="Publishing…"
      cancelHref="/feed"
      onSubmit={async (values) => {
        // PostsContext saves it and refreshes the dashboard and feed.
        const result = await createPost(values);
        if (!result.ok) return result.error;

        router.push(`/posts/${result.data.post.id}`);
        router.refresh();
        return null;
      }}
    />
  );
}
