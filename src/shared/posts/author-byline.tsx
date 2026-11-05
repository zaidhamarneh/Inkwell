import type { PostAuthor } from "@/shared/repositories/types";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { formatDate, getInitials } from "@/shared/utils";

type AuthorBylineProps = {
  author: PostAuthor;
  date: Date;
  /** Shows "(edited)" when set and different from `date`. */
  updatedAt?: Date;
  /** Adds "· N min read" when set. */
  readingMinutes?: number;
  size?: "sm" | "default";
};

/** Avatar, name and date, e.g. "(AL) Ada Lovelace · Nov 5, 2026". */
export function AuthorByline({
  author,
  date,
  updatedAt,
  readingMinutes,
  size = "default",
}: AuthorBylineProps) {
  const edited = updatedAt && updatedAt.getTime() - date.getTime() > 60_000;

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <Avatar size={size === "sm" ? "sm" : "default"}>
        <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
          {getInitials(author.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-foreground">{author.name}</span>
      <span aria-hidden>·</span>
      <time dateTime={date.toISOString()} className="shrink-0">
        {formatDate(date)}
      </time>
      {edited && <span className="shrink-0">(edited)</span>}
      {readingMinutes !== undefined && (
        <>
          <span aria-hidden>·</span>
          <span className="shrink-0 whitespace-nowrap">{readingMinutes} min read</span>
        </>
      )}
    </div>
  );
}
