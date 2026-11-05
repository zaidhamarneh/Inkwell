"use client";

import { Button } from "@/shared/ui/button";

/**
 * Catches errors while rendering a signed-in page, including a rejected
 * promise read with use() or a failed streamed query. Server error details
 * never reach here (Next.js replaces them with a generic message + digest).
 */
export default function ProtectedError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-3 px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page couldn&apos;t load. Try again in a moment.
      </p>
      <div>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
      {digest && <p className="text-xs text-muted-foreground">Error ID: {digest}</p>}
    </main>
  );
}
