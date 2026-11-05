import Link from "next/link";

import { ThemeToggle } from "@/shared/theme/theme-toggle";

import { NavLinks } from "./nav-links";
import { UserMenu, type MenuUser } from "./user-menu";

/**
 * Top bar for signed-in pages: brand, page links, theme switch and the
 * account menu. On narrow screens the links move to a second row.
 */
export function Navbar({ user }: { user: MenuUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href="/dashboard"
          className="rounded-md text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Inkwell
        </Link>

        <NavLinks className="order-last -mx-1 w-full overflow-x-auto sm:order-none sm:mx-0 sm:w-auto" />

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
