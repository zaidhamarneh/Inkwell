import Link from "next/link";

import { Logo } from "@/shared/brand/logo";
import { ThemeToggle } from "@/shared/theme/theme-toggle";
import { Button } from "@/shared/ui/button";

/** Top bar for signed-out visitors: brand, theme switch, log in, sign up. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/register">Start writing</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
