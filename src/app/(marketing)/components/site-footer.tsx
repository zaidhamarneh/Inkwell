import Link from "next/link";

import { Logo } from "@/shared/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <span>A quiet place to write.</span>
        </div>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/login" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            Log in
          </Link>
          <Link href="/register" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            Create an account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
