import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireSession } from "@/shared/auth/session";
import { CommentListSkeleton } from "@/shared/posts/skeletons";
import { listComments } from "@/shared/repositories/comment-repository";
import { getQueryClient, HydrateClient, trpc } from "@/shared/trpc/server";

import { CommentForm } from "./comment-form";
import { CommentCount, CommentList } from "./comment-list";
import { PostArticle } from "./post-article";

/**
 * Everything on the post page that needs the request (session, URL params,
 * database). The page renders this inside <Suspense>, so navigating to a
 * post shows its frame instantly while this streams in.
 */
export async function PostContent({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { user } = await requireSession();
  const { postId } = await params;

  // Start loading comments now but don't wait: the promise goes to the
  // client, which shows a skeleton until it resolves (React's use()).
  const commentsPromise = listComments(postId, user.id);
  // If we bail out with notFound() below, nothing reads this promise; mark
  // it handled so a failure then isn't an unhandled rejection. use() still
  // sees the rejection (and the error boundary shows it) when it is read.
  commentsPromise.catch(() => {});

  // Awaited on purpose: whether the post exists decides "not found".
  // The result lands in the tRPC cache for PostArticle.
  const post = await getQueryClient().fetchQuery(
    trpc.posts.byId.queryOptions({ postId }),
  );
  if (!post) notFound();

  return (
    <>
      <HydrateClient>
        <PostArticle postId={postId} />
      </HydrateClient>

      <section id="comments" aria-labelledby="comments-heading" className="mt-10 grid gap-6">
        <h2 id="comments-heading" className="text-lg font-semibold">
          Comments{" "}
          <Suspense fallback={null}>
            <CommentCount commentsPromise={commentsPromise} />
          </Suspense>
        </h2>
        <CommentForm postId={post.id} />
        <Suspense fallback={<CommentListSkeleton />}>
          <CommentList commentsPromise={commentsPromise} />
        </Suspense>
      </section>
    </>
  );
}
