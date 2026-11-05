import { PenLineIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/shared/brand/logo";
import { ThemeToggle } from "@/shared/theme/theme-toggle";
import { Button } from "@/shared/ui/button";

import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

/**
 * Top bar for signed-in pages: brand, page links, theme switch and the
 * account menu (which reads the user from AuthContext). On narrow screens the links move to a second row.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Logo href="/dashboard" />

        <NavLinks className="order-last -mx-1 w-full overflow-x-auto sm:order-none sm:mx-0 sm:w-auto" />

        <div className="ml-auto flex items-center gap-2">
          <Button asChild>
            <Link href="/posts/new">
              <PenLineIcon aria-hidden data-icon="inline-start" />
              Write
            </Link>
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
