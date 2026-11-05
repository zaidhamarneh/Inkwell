import { cn } from "cn";
import { FeatherIcon } from "lucide-react";
import Link from "next/link";

/**
 * The Inkwell wordmark: a quill in an ink-blue tile plus the name in the
 * serif. Links to `href` (the landing page by default).
 */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30"
      >
        <FeatherIcon className="size-4" />
      </span>
      <span className="font-serif text-xl leading-none font-semibold tracking-tight">Inkwell</span>
    </Link>
  );
}
