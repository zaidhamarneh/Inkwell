"use client";

import { useRouter } from "next/navigation";
import { use } from "react";

import { PostForm } from "@/shared/posts/post-form";
import { NotYourPost, PostNotFound } from "@/shared/posts/post-not-found";
import type { PostInput } from "@/shared/schemas/post/post";
import { usePosts } from "@/shared/state/posts-context";

/** What the edit page may show, decided on the server by the ownership check. */
export type EditPostState =
  | { status: "owner"; post: PostInput }
  | { status: "not_found" }
  | { status: "forbidden" };

type EditPostFormProps = {
  postId: string;
  /** Started (not awaited) by the page on the server; resolved here with use(). */
  statePromise: Promise<EditPostState>;
};

export function EditPostForm({ postId, statePromise }: EditPostFormProps) {
  const router = useRouter();
  const { updatePost } = usePosts();
  const state = use(statePromise);
  const postHref = `/posts/${postId}`;

  if (state.status === "not_found") return <PostNotFound />;
  if (state.status === "forbidden") return <NotYourPost postId={postId} />;
  const { post } = state;

  return (
    <PostForm
      defaultValues={{ title: post.title, content: post.content }}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      cancelHref={postHref}
      onSubmit={async (values) => {
        // PostsContext saves it and refreshes this post and the lists.
        const result = await updatePost(postId, values);
        if (!result.ok) return result.error;

        router.push(postHref);
        router.refresh();
        return null;
      }}
    />
  );
}
