"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiPost } from "@/shared/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export type MenuUser = {
  name: string;
  email: string;
  image: string | null;
};

/** "Ada Lovelace" → "AL", "Haid" → "H", falls back to the email's first letter. */
export function getInitials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (word?: string) => (word ? Array.from(word)[0] : "");

  const initials =
    words.length > 1
      ? first(words[0]) + first(words[words.length - 1])
      : first(words[0]) || first(email);

  return (initials || "?").toUpperCase();
}

export function UserMenu({ user }: { user: MenuUser }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");

  async function signOut(event: Event) {
    // Keep the menu open while the request runs so errors stay visible.
    event.preventDefault();
    setStatus("pending");

    // Revokes the session in the database and clears the cookie.
    const result = await apiPost("/auth/logout");
    if (!result.ok) {
      setStatus("failed");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && setStatus("idle")}>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="font-medium text-foreground">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {user.name}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={signOut}
          disabled={status === "pending"}
          className="px-2 py-1.5"
        >
          <LogOutIcon aria-hidden />
          {status === "pending" ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>

        {status === "failed" && (
          <p role="alert" className="px-2 pb-1.5 text-xs text-destructive">
            Couldn&apos;t sign out. Try again.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
