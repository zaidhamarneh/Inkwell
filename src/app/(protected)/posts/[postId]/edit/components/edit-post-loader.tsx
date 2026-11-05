import { requireSession } from "@/shared/auth/session";
import { checkOwnership } from "@/shared/auth/ownership";
import { getPostForEdit } from "@/shared/repositories/post-repository";

import { EditPostForm, type EditPostState } from "./edit-post-form";

/**
 * Request-time part of the edit page (session, URL params). Rendered inside
 * the page's <Suspense>, so the heading shows instantly on navigation.
 */
export async function EditPostLoader({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { user } = await requireSession();
  const { postId } = await params;

  // Not awaited: the form reads it with use() and suspends into the same
  // boundary. Same ownership rule as the PUT/DELETE API (ownership.ts); the
  // post's content is only sent to the browser when the user wrote it.
  const statePromise: Promise<EditPostState> = getPostForEdit(postId).then((post) => {
    const ownership = checkOwnership(post?.authorId ?? null, user.id);
    if (!post || ownership === "not_found") return { status: "not_found" };
    if (ownership === "forbidden") return { status: "forbidden" };
    return { status: "owner", post: { title: post.title, content: post.content } };
  });

  return <EditPostForm postId={postId} statePromise={statePromise} />;
}
