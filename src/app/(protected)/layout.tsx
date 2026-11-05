import { Suspense } from "react";

import { requireSession } from "@/shared/auth/session";
import { Navbar } from "@/shared/navbar/navbar";
import { CurrentUserProvider } from "@/shared/state/auth-context";
import { PostsProvider } from "@/shared/state/posts-context";

// Every page in (protected) renders only after the session is verified
// against the database. src/proxy.ts redirects most signed-out requests
// earlier; this is the check that can't be skipped.
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}

async function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

  // App state for signed-in pages (Context API): the verified user and the
  // blog post data/actions. See src/shared/state/.
  return (
    <CurrentUserProvider user={{ id: user.id, name: user.name, email: user.email }}>
      <PostsProvider>
        <Navbar />
        <div className="flex flex-1 flex-col">{children}</div>
      </PostsProvider>
    </CurrentUserProvider>
  );
}
