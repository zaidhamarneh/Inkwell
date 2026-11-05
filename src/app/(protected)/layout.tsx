import { Suspense } from "react";

import { requireSession } from "@/shared/auth/session";

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
      <RequireSession>{children}</RequireSession>
    </Suspense>
  );
}

async function RequireSession({ children }: { children: React.ReactNode }) {
  await requireSession();
  return children;
}
