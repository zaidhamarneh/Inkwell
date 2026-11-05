import { requireSession } from "@/shared/auth/session";
import { getOwnPost } from "@/shared/repositories/post-repository";

import { EditPostForm } from "./edit-post-form";

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
  // boundary until it resolves. Only the author gets data back (else null).
  const postPromise = getOwnPost(postId, user.id);

  return <EditPostForm postId={postId} postPromise={postPromise} />;
}
