import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PostPageSkeleton } from "@/shared/posts/skeletons";

import { PostContent } from "./components/post-content";

// No request-time work at the top level: the back link and frame render
// instantly on navigation; the post and comments stream in (PostContent).
export default function PostPage({ params }: PageProps<"/posts/[postId]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Dashboard
      </Link>

      <Suspense fallback={<PostPageSkeleton />}>
        <PostContent params={params} />
      </Suspense>
    </main>
  );
}
