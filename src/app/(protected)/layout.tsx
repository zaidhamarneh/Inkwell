import { Suspense } from "react";

import { requireSession } from "@/shared/auth/session";
import { Navbar } from "@/shared/navbar/navbar";

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

  return (
    <>
      <Navbar
        user={{ name: user.name, email: user.email, image: user.image ?? null }}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
