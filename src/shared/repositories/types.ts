// Shapes the repositories return to pages. Type-only, so safe to import from
// client components. Author emails are deliberately never included.

export type PostAuthor = {
  id: string;
  name: string;
  image: string | null;
};

/** A post as shown in a list (dashboard, feed). */
export type PostSummary = {
  id: string;
  title: string;
  excerpt: string;
  author: PostAuthor;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  commentCount: number;
  /** Whether the current user has liked it. */
  likedByMe: boolean;
  /** Whether the current user wrote it. */
  isMine: boolean;
};

/** A post as shown on its own page. */
export type PostDetail = Omit<PostSummary, "excerpt"> & { content: string };

export type CommentItem = {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt: Date;
  isMine: boolean;
};

/** One page of a post list; pass nextCursor back to get the next page. */
export type PostPage = {
  items: PostSummary[];
  nextCursor: string | null;
};
