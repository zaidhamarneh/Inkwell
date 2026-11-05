import { cn } from "cn";
import { HeartIcon, MessageCircleIcon } from "lucide-react";

type PostPreviewProps = {
  title: string;
  excerpt: string;
  author: string;
  initials: string;
  date: string;
  minutes: number;
  likes: number;
  comments: number;
  liked?: boolean;
  className?: string;
};

/**
 * A static picture of a post card for the landing page. Looks like the real
 * PostCard but has no links or buttons: it's an illustration.
 */
export function PostPreview({
  title,
  excerpt,
  author,
  initials,
  date,
  minutes,
  likes,
  comments,
  liked = false,
  className,
}: PostPreviewProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-5 shadow-xl shadow-primary/5 dark:shadow-black/30",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-5 left-0 w-[3px] rounded-r-full bg-primary" />
      <p className="font-serif text-xl leading-snug font-semibold tracking-tight">{title}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{excerpt}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[0.65rem] font-semibold text-accent-foreground">
            {initials}
          </span>
          <span className="truncate font-medium text-foreground">{author}</span>
          <span>·</span>
          <span className="shrink-0">{date}</span>
          <span className="hidden sm:inline">· {minutes} min read</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn("inline-flex items-center gap-1", liked && "text-rose-600 dark:text-rose-400")}>
            <HeartIcon className={cn("size-3.5", liked && "fill-current")} />
            {likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleIcon className="size-3.5" />
            {comments}
          </span>
        </div>
      </div>
    </div>
  );
}
