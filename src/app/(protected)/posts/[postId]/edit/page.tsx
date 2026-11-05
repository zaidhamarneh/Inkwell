import { Suspense } from "react";

import { PostFormSkeleton } from "@/shared/posts/skeletons";

import { EditPostLoader } from "./components/edit-post-loader";

// No request-time work at the top level: the heading renders instantly on
// navigation, and the form streams in behind the skeleton.
export default function EditPostPage({ params }: PageProps<"/posts/[postId]/edit">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Edit post</h1>
      <Suspense fallback={<PostFormSkeleton />}>
        <EditPostLoader params={params} />
      </Suspense>
    </main>
  );
}
