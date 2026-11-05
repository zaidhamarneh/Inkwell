import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { PostInput } from "@/shared/schemas/post/post";
import { prisma } from "@/shared/db/db";

import type { PostDetail, PostPage, PostSummary } from "./types";

export const POSTS_PAGE_SIZE = 20;
const EXCERPT_LENGTH = 200;

const authorSelect = { id: true, name: true, image: true } satisfies Prisma.UserSelect;

/** Fields needed to show a post to `viewerId` (counts, liked-by-me). */
function postSelect(viewerId: string) {
  return {
    id: true,
    title: true,
    content: true,
    authorId: true,
    createdAt: true,
    updatedAt: true,
    author: { select: authorSelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
  } satisfies Prisma.PostSelect;
}

type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

function toDetail(row: PostRow, viewerId: string): PostDetail {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: row.author,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    likeCount: row._count.likes,
    commentCount: row._count.comments,
    likedByMe: row.likes.length > 0,
    isMine: row.authorId === viewerId,
  };
}

function toSummary(row: PostRow, viewerId: string): PostSummary {
  const { content, ...rest } = toDetail(row, viewerId);
  return { ...rest, excerpt: makeExcerpt(content) };
}

function makeExcerpt(content: string) {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH
    ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : flat;
}

/**
 * Newest posts first, POSTS_PAGE_SIZE at a time. Pass `authorId` for one
 * person's posts, and the previous page's `nextCursor` for older posts.
 */
export async function listPosts({
  viewerId,
  authorId,
  cursor,
}: {
  viewerId: string;
  authorId?: string;
  cursor?: string;
}): Promise<PostPage> {
  const rows = await prisma.post.findMany({
    where: authorId ? { authorId } : undefined,
    select: postSelect(viewerId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: POSTS_PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = rows.length > POSTS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, POSTS_PAGE_SIZE) : rows;

  return {
    items: page.map((row) => toSummary(row, viewerId)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getPost(
  postId: string,
  viewerId: string,
): Promise<PostDetail | null> {
  const row = await prisma.post.findUnique({
    where: { id: postId },
    select: postSelect(viewerId),
  });
  return row ? toDetail(row, viewerId) : null;
}

/** The post's editable fields, only if `userId` wrote it. */
export async function getOwnPost(postId: string, userId: string) {
  return prisma.post.findFirst({
    where: { id: postId, authorId: userId },
    select: { id: true, title: true, content: true },
  });
}

const apiPostSelect = {
  id: true,
  title: true,
  content: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

export async function createPost(authorId: string, input: PostInput) {
  return prisma.post.create({
    data: { ...input, authorId },
    select: apiPostSelect,
  });
}

/** Replaces title and content. Returns null if the post doesn't exist or isn't the author's. */
export async function updatePost(
  postId: string,
  authorId: string,
  input: PostInput,
) {
  try {
    return await prisma.post.update({
      where: { id: postId, authorId },
      data: input,
      select: apiPostSelect,
    });
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** Deletes the post (and its comments and likes). False if missing or not the author's. */
export async function deletePost(postId: string, authorId: string) {
  const { count } = await prisma.post.deleteMany({
    where: { id: postId, authorId },
  });
  return count > 0;
}

function isRecordNotFound(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
